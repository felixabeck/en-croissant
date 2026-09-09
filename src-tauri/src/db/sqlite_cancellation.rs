use std::{
    cell::RefCell,
    ffi::{c_char, c_int, c_void},
    panic::{catch_unwind, AssertUnwindSafe},
    sync::OnceLock,
};

use rusqlite::ffi;
use tokio_util::sync::CancellationToken;

use crate::error::Error;

#[cfg(not(test))]
const SQLITE_PROGRESS_VM_STEPS: c_int = 1_000;
#[cfg(test)]
const SQLITE_PROGRESS_VM_STEPS: c_int = 1;

struct Scope {
    cancellation: CancellationToken,
    interrupted: bool,
    callback_panicked: bool,
}

thread_local! {
    static SCOPE: RefCell<Option<Scope>> = const { RefCell::new(None) };
    #[cfg(test)]
    static CALLBACK_HOOK: RefCell<Option<Box<dyn FnMut()>>> = const { RefCell::new(None) };
}

static INSTALL_RESULT: OnceLock<c_int> = OnceLock::new();

unsafe extern "C" fn progress_callback(_context: *mut c_void) -> c_int {
    match catch_unwind(AssertUnwindSafe(|| {
        #[cfg(test)]
        CALLBACK_HOOK.with(|hook| {
            if let Some(hook) = hook.borrow_mut().as_mut() {
                hook();
            }
        });
        SCOPE
            .try_with(|scope| {
                let mut scope = scope.borrow_mut();
                let Some(scope) = scope.as_mut() else {
                    return 0;
                };
                if scope.cancellation.is_cancelled() {
                    scope.interrupted = true;
                    1
                } else {
                    0
                }
            })
            .unwrap_or(0)
    })) {
        Ok(result) => result,
        Err(_) => {
            let _ = SCOPE.try_with(|scope| {
                if let Ok(mut scope) = scope.try_borrow_mut() {
                    if let Some(scope) = scope.as_mut() {
                        scope.callback_panicked = true;
                    }
                }
            });
            1
        }
    }
}

unsafe extern "C" fn install_on_connection(
    database: *mut ffi::sqlite3,
    _error: *mut *mut c_char,
    _api: *const ffi::sqlite3_api_routines,
) -> c_int {
    match catch_unwind(AssertUnwindSafe(|| unsafe {
        ffi::sqlite3_progress_handler(
            database,
            SQLITE_PROGRESS_VM_STEPS,
            Some(progress_callback),
            std::ptr::null_mut(),
        );
    })) {
        Ok(()) => ffi::SQLITE_OK,
        Err(_) => ffi::SQLITE_ERROR,
    }
}

/// Registers the documented SQLite auto-extension before a repository connection is opened.
pub fn install() -> Result<(), Error> {
    let result = *INSTALL_RESULT.get_or_init(|| {
        // sqlite3_auto_extension declares a no-argument callback type even though SQLite invokes
        // extension entry points with the three documented parameters. This ABI cast is required
        // by SQLite's public C API and is kept at this one boundary.
        let entry = unsafe {
            std::mem::transmute::<
                unsafe extern "C" fn(
                    *mut ffi::sqlite3,
                    *mut *mut c_char,
                    *const ffi::sqlite3_api_routines,
                ) -> c_int,
                unsafe extern "C" fn(),
            >(install_on_connection)
        };
        unsafe { ffi::sqlite3_auto_extension(Some(entry)) }
    });
    if result == ffi::SQLITE_OK {
        Ok(())
    } else {
        Err(Error::Conflict(format!(
            "SQLite cancellation callback registration failed with code {result}"
        )))
    }
}

struct ScopeGuard;

impl Drop for ScopeGuard {
    fn drop(&mut self) {
        let _ = SCOPE.try_with(|scope| {
            if let Ok(mut scope) = scope.try_borrow_mut() {
                *scope = None;
            }
        });
        #[cfg(test)]
        let _ = CALLBACK_HOOK.try_with(|hook| *hook.borrow_mut() = None);
    }
}

fn enter_scope(cancellation: &CancellationToken) -> Result<ScopeGuard, Error> {
    SCOPE
        .try_with(|scope| {
            let mut scope = scope.try_borrow_mut().map_err(|_| {
                Error::Conflict("SQLite cancellation scope is already borrowed".into())
            })?;
            if scope.is_some() {
                return Err(Error::Conflict("nested SQLite cancellation scope".into()));
            }
            *scope = Some(Scope {
                cancellation: cancellation.clone(),
                interrupted: false,
                callback_panicked: false,
            });
            Ok(ScopeGuard)
        })
        .map_err(|_| Error::Conflict("SQLite cancellation thread state is unavailable".into()))?
}

fn finish_scope(guard: ScopeGuard, query_failed: bool) -> Result<(), Error> {
    let (interrupted, callback_panicked) = SCOPE
        .try_with(|scope| {
            let scope = scope.borrow();
            let scope = scope
                .as_ref()
                .ok_or_else(|| Error::Conflict("SQLite cancellation scope disappeared".into()))?;
            Ok::<_, Error>((scope.interrupted, scope.callback_panicked))
        })
        .map_err(|_| Error::Conflict("SQLite cancellation thread state is unavailable".into()))??;
    drop(guard);
    if callback_panicked {
        return Err(Error::Conflict(
            "SQLite cancellation callback panicked".into(),
        ));
    }
    if interrupted && query_failed {
        return Err(Error::Cancellation);
    }
    Ok(())
}

/// Runs one synchronous Diesel query, including iterator consumption, under the SQLite VM
/// cancellation callback. Connection acquisition and schema work must happen before this scope.
pub fn with_sqlite_cancellation<T, E>(
    cancellation: &CancellationToken,
    query: impl FnOnce() -> Result<T, E>,
) -> Result<T, Error>
where
    E: Into<Error>,
{
    let guard = enter_scope(cancellation)?;
    let result = query().map_err(Into::into);
    finish_scope(guard, result.is_err())?;
    result
}

#[cfg(test)]
pub(crate) fn cancel_on_callback(
    cancellation: CancellationToken,
    callback_number: usize,
) -> std::sync::Arc<std::sync::atomic::AtomicUsize> {
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    let checkpoints = Arc::new(AtomicUsize::new(0));
    let observed = Arc::clone(&checkpoints);
    CALLBACK_HOOK.with(|hook| {
        *hook.borrow_mut() = Some(Box::new(move || {
            if observed.fetch_add(1, Ordering::SeqCst) + 1 >= callback_number {
                cancellation.cancel();
            }
        }));
    });
    checkpoints
}

#[cfg(test)]
mod tests {
    use super::*;
    use diesel::{connection::SimpleConnection, Connection, SqliteConnection};
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    fn exercise_factory(mode: &str) {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("factory.db3");
        let repository = crate::db::DatabaseRepository::default();
        let mut connection = if mode == "pool" {
            repository.initialization_connection(&path).unwrap()
        } else if mode == "identity-first-pool" {
            let seed = SqliteConnection::establish(path.to_str().unwrap()).unwrap();
            drop(seed);
            repository.database_identity(&path).unwrap();
            repository.initialization_connection(&path).unwrap()
        } else {
            let seed = SqliteConnection::establish(path.to_str().unwrap()).unwrap();
            drop(seed);
            let file = std::fs::File::open(&path).unwrap();
            let identity = crate::infra::path_authority::opened_file_identity(&file).unwrap();
            repository
                .schema_specific_connection_expected_file_cancellable(
                    file,
                    identity,
                    &CancellationToken::new(),
                )
                .unwrap()
        };
        let token = CancellationToken::new();
        let cancellation = token.clone();
        CALLBACK_HOOK.with(|hook| {
            *hook.borrow_mut() = Some(Box::new(move || cancellation.cancel()));
        });
        let result = with_sqlite_cancellation(&token, || {
            connection.batch_execute("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) SELECT sum(x) FROM n")
        });
        assert!(matches!(result, Err(Error::Cancellation)));
    }

    fn isolated_factory_test(test_name: &str, mode: &str) {
        const CHILD: &str = "CHESSFABLE_SQLITE_FACTORY_CHILD";
        if std::env::var(CHILD).as_deref() == Ok(mode) {
            exercise_factory(mode);
            return;
        }
        let mut child = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", test_name, "--nocapture"])
            .env(CHILD, mode)
            .spawn()
            .unwrap();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
        let status = loop {
            if let Some(status) = child.try_wait().unwrap() {
                break status;
            }
            if std::time::Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                panic!("isolated {mode} factory probe timed out");
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        };
        assert!(status.success(), "isolated {mode} factory probe failed");
    }

    #[test]
    fn pooled_repository_factory_installs_callback_in_isolated_process() {
        isolated_factory_test(
            "db::sqlite_cancellation::tests::pooled_repository_factory_installs_callback_in_isolated_process",
            "pool",
        );
    }

    #[test]
    fn pinned_repository_factory_installs_callback_in_isolated_process() {
        isolated_factory_test(
            "db::sqlite_cancellation::tests::pinned_repository_factory_installs_callback_in_isolated_process",
            "pinned",
        );
    }

    #[test]
    fn identity_first_pool_factory_installs_callback_in_isolated_process() {
        isolated_factory_test(
            "db::sqlite_cancellation::tests::identity_first_pool_factory_installs_callback_in_isolated_process",
            "identity-first-pool",
        );
    }

    #[test]
    fn real_query_is_interrupted_and_connection_recovers() {
        install().unwrap();
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        let token = CancellationToken::new();
        let checkpoints = Arc::new(AtomicUsize::new(0));
        let hook_checkpoints = Arc::clone(&checkpoints);
        let cancellation = token.clone();
        CALLBACK_HOOK.with(|hook| {
            *hook.borrow_mut() = Some(Box::new(move || {
                if hook_checkpoints.fetch_add(1, Ordering::SeqCst) >= 1 {
                    cancellation.cancel();
                }
            }));
        });
        let result = with_sqlite_cancellation(&token, || {
            connection.batch_execute("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) SELECT sum(x) FROM n")
        });
        assert!(matches!(result, Err(Error::Cancellation)));
        assert!(checkpoints.load(Ordering::SeqCst) >= 2);
        connection.batch_execute("SELECT 1").unwrap();
    }

    #[test]
    fn real_pooled_repository_connection_recovers_after_interruption() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("pooled-recovery.db3");
        let repository = crate::db::DatabaseRepository::default();
        let mut connection = repository.initialization_connection(&path).unwrap();
        let token = CancellationToken::new();
        let checkpoints = cancel_on_callback(token.clone(), 2);
        let result = with_sqlite_cancellation(&token, || {
            connection.batch_execute("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) SELECT sum(x) FROM n")
        });
        assert!(matches!(result, Err(Error::Cancellation)));
        assert!(checkpoints.load(Ordering::SeqCst) >= 2);
        connection.batch_execute("SELECT 1").unwrap();
    }

    #[test]
    fn panic_clears_scope() {
        install().unwrap();
        let token = CancellationToken::new();
        let _ = std::panic::catch_unwind(|| {
            let _: Result<(), Error> =
                with_sqlite_cancellation(&token, || -> Result<(), Error> { panic!("query panic") });
        });
        let result = with_sqlite_cancellation(&token, || Ok::<_, diesel::result::Error>(1));
        assert_eq!(result.unwrap(), 1);
    }

    #[test]
    fn unrelated_database_errors_are_not_reclassified() {
        install().unwrap();
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        let result = with_sqlite_cancellation(&CancellationToken::new(), || {
            connection.batch_execute("SELECT * FROM table_that_does_not_exist")
        });
        assert!(matches!(result, Err(Error::Diesel(_))));
    }

    #[test]
    fn scopes_are_thread_local_and_do_not_replace_success_after_late_cancellation() {
        install().unwrap();
        let token = CancellationToken::new();
        let late = token.clone();
        let successful = with_sqlite_cancellation(&token, || {
            late.cancel();
            Ok::<_, Error>(7)
        });
        assert_eq!(successful.unwrap(), 7);

        let sibling = std::thread::spawn(|| {
            let mut connection = SqliteConnection::establish(":memory:").unwrap();
            connection.batch_execute("SELECT 1")
        });
        sibling.join().unwrap().unwrap();
    }

    #[test]
    fn cancelling_one_concurrent_scope_does_not_interrupt_its_sibling() {
        install().unwrap();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (start_tx, start_rx) = std::sync::mpsc::channel();
        let cancelled = std::thread::spawn(move || {
            let mut connection = SqliteConnection::establish(":memory:").unwrap();
            let token = CancellationToken::new();
            let cancellation = token.clone();
            CALLBACK_HOOK.with(|hook| {
                *hook.borrow_mut() = Some(Box::new(move || cancellation.cancel()));
            });
            ready_tx.send(()).unwrap();
            start_rx
                .recv_timeout(std::time::Duration::from_secs(5))
                .unwrap();
            with_sqlite_cancellation(&token, || {
                connection.batch_execute("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) SELECT sum(x) FROM n")
            })
        });
        let sibling = std::thread::spawn(move || {
            let mut connection = SqliteConnection::establish(":memory:").unwrap();
            ready_rx
                .recv_timeout(std::time::Duration::from_secs(5))
                .unwrap();
            start_tx.send(()).unwrap();
            with_sqlite_cancellation(&CancellationToken::new(), || {
                connection.batch_execute("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000) SELECT sum(x) FROM n")
            })
        });
        assert!(matches!(
            cancelled.join().unwrap(),
            Err(Error::Cancellation)
        ));
        sibling.join().unwrap().unwrap();
    }

    #[test]
    fn nested_scope_is_rejected_without_replacing_the_outer_scope() {
        let token = CancellationToken::new();
        let nested = with_sqlite_cancellation(&token, || {
            let nested = with_sqlite_cancellation(&token, || Ok::<_, Error>(()));
            assert!(matches!(nested, Err(Error::Conflict(_))));
            Ok::<_, Error>(())
        });
        nested.unwrap();
    }

    #[test]
    fn callback_panic_is_contained_and_scope_is_cleared() {
        install().unwrap();
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        CALLBACK_HOOK.with(|hook| {
            *hook.borrow_mut() = Some(Box::new(|| panic!("injected callback panic")));
        });
        let result = with_sqlite_cancellation(&CancellationToken::new(), || {
            connection.batch_execute("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) SELECT sum(x) FROM n")
        });
        assert!(matches!(result, Err(Error::Conflict(_))));
        connection.batch_execute("SELECT 1").unwrap();
    }

    #[test]
    fn cancelled_token_does_not_interrupt_schema_or_write_outside_scope() {
        install().unwrap();
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        let token = CancellationToken::new();
        token.cancel();
        connection
            .batch_execute("CREATE TABLE accepted (id INTEGER); INSERT INTO accepted VALUES (1)")
            .unwrap();
        assert!(matches!(
            with_sqlite_cancellation(&token, || {
                connection.batch_execute(
                "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) SELECT sum(x) FROM n"
            )
            }),
            Err(Error::Cancellation)
        ));
        connection
            .batch_execute("INSERT INTO accepted VALUES (2)")
            .unwrap();
    }
}
