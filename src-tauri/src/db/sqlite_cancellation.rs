use std::{
    cell::RefCell,
    ffi::{c_char, c_int, c_void},
    panic::{catch_unwind, AssertUnwindSafe},
    sync::OnceLock,
};

use diesel::{Connection, SqliteConnection};
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
    #[cfg(test)]
    static BEFORE_COMMIT_HOOK: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
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

/// Runs a synchronous query scope covering every statement the closure runs, including iterator
/// consumption, under the SQLite VM cancellation callback. Connection acquisition and
/// migration/validation must happen before this scope. Schema DDL uses
/// `with_sqlite_cancellation_transaction` to keep transaction tails unarmed.
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

/// Runs a top-level transaction with cancellation armed only around its body, never around BEGIN,
/// COMMIT or ROLLBACK. Do not call inside another transaction or cancellation scope.
/// After SQLite auto-rolls back an interrupted write, Diesel's manager is in error: the connection
/// must not be reused for a transaction. Repository pools discard it through `has_broken`.
pub fn with_sqlite_cancellation_transaction<T>(
    connection: &mut SqliteConnection,
    cancellation: &CancellationToken,
    body: impl FnOnce(&mut SqliteConnection) -> Result<T, Error>,
) -> Result<T, Error> {
    let mut cancelled = false;
    let result = connection.transaction::<_, Error, _>(|connection| {
        let result = with_sqlite_cancellation(cancellation, || body(connection));
        cancelled = matches!(result, Err(Error::Cancellation));
        let value = result?;
        if cancellation.is_cancelled() {
            cancelled = true;
            return Err(Error::Cancellation);
        }
        #[cfg(test)]
        BEFORE_COMMIT_HOOK.with(|hook| {
            if let Some(hook) = hook.borrow_mut().take() {
                hook();
            }
        });
        Ok(value)
    });
    classify_transaction_outcome(result, cancelled)
}

fn classify_transaction_outcome<T>(result: Result<T, Error>, cancelled: bool) -> Result<T, Error> {
    if cancelled {
        if let Err(Error::Diesel(error)) = &result {
            if let diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::Unknown,
                information,
            ) = error.as_ref()
            {
                if information.message() == "cannot rollback - no transaction is active" {
                    return Err(Error::Cancellation);
                }
            }
        }
    }
    result
}

#[cfg(test)]
pub(crate) fn set_callback_hook(hook: impl FnMut() + 'static) {
    CALLBACK_HOOK.with(|slot| *slot.borrow_mut() = Some(Box::new(hook)));
}

#[cfg(test)]
pub(crate) fn cancel_on_callback(
    cancellation: CancellationToken,
    callback_number: usize,
) -> std::sync::Arc<std::sync::atomic::AtomicUsize> {
    cancel_on_callback_when(cancellation, callback_number, || true)
}

/// Counts only callbacks in a body scope, so connection setup cannot trigger a DDL test's cancel.
#[cfg(test)]
pub(crate) fn cancel_on_scoped_callback(
    cancellation: CancellationToken,
    callback_number: usize,
) -> std::sync::Arc<std::sync::atomic::AtomicUsize> {
    cancel_on_callback_when(cancellation, callback_number, || {
        SCOPE.with(|scope| scope.borrow().is_some())
    })
}

#[cfg(test)]
fn cancel_on_callback_when(
    cancellation: CancellationToken,
    callback_number: usize,
    eligible: impl Fn() -> bool + 'static,
) -> std::sync::Arc<std::sync::atomic::AtomicUsize> {
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    let checkpoints = Arc::new(AtomicUsize::new(0));
    let observed = Arc::clone(&checkpoints);
    set_callback_hook(move || {
        if eligible() && observed.fetch_add(1, Ordering::SeqCst) + 1 >= callback_number {
            cancellation.cancel();
        }
    });
    checkpoints
}

#[cfg(test)]
mod transaction_tests {
    use super::*;
    use diesel::connection::SimpleConnection;
    use std::sync::atomic::Ordering;

    fn memory() -> SqliteConnection {
        install().unwrap();
        let mut connection = SqliteConnection::establish(":memory:").unwrap();
        connection
            .batch_execute("CREATE TABLE items (id INTEGER); CREATE INDEX original ON items(id);")
            .unwrap();
        connection
    }

    #[test]
    fn ddl_interruption_restores_schema_and_pool_recovers() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("ddl.db3");
        let repository = crate::db::DatabaseRepository::default();
        let target = crate::db::test_target(&path);
        let mut connection = repository.initialization_connection(&target, None).unwrap();
        connection
            .batch_execute("CREATE TABLE items (id INTEGER); CREATE INDEX original ON items(id);")
            .unwrap();
        let before = crate::db::index_cancellation_tests::index_list(&mut connection);
        let token = CancellationToken::new();
        let result = with_sqlite_cancellation_transaction(&mut connection, &token, |connection| {
            connection.batch_execute("DROP INDEX original")?;
            let observed = cancel_on_callback(token.clone(), 5);
            let result = connection.batch_execute("CREATE INDEX replacement ON items(id)");
            assert!(observed.load(Ordering::SeqCst) >= 5);
            result.map_err(Into::into)
        });
        assert!(matches!(result, Err(Error::Cancellation)), "{result:?}");
        assert!(<SqliteConnection as diesel::r2d2::R2D2Connection>::is_broken(&mut connection));
        assert_eq!(
            crate::db::index_cancellation_tests::index_list(&mut connection),
            before
        );
        drop(connection);
        let mut fresh = repository.initialization_connection(&target, None).unwrap();
        assert!(!<SqliteConnection as diesel::r2d2::R2D2Connection>::is_broken(&mut fresh));
        fresh
            .transaction::<_, Error, _>(|connection| {
                connection.batch_execute("CREATE INDEX recovered ON items(id)")?;
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn pre_commit_cancel_rolls_back_and_same_connection_recovers() {
        let mut connection = memory();
        let before = crate::db::index_cancellation_tests::index_list(&mut connection);
        let token = CancellationToken::new();
        let result = with_sqlite_cancellation_transaction(&mut connection, &token, |connection| {
            connection.batch_execute("DROP INDEX original")?;
            token.cancel();
            Ok(())
        });
        assert!(matches!(result, Err(Error::Cancellation)), "{result:?}");
        assert_eq!(
            crate::db::index_cancellation_tests::index_list(&mut connection),
            before
        );
        connection
            .transaction::<_, Error, _>(|connection| {
                connection.batch_execute("CREATE INDEX recovered ON items(id)")?;
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn uncancelled_body_commits() {
        let mut connection = memory();
        with_sqlite_cancellation_transaction(
            &mut connection,
            &CancellationToken::new(),
            |connection| {
                connection.batch_execute("DROP INDEX original")?;
                Ok(())
            },
        )
        .unwrap();
        assert!(crate::db::index_cancellation_tests::index_list(&mut connection).is_empty());
    }

    #[test]
    fn commit_is_unarmed_and_late_cancellation_keeps_committed_success() {
        let mut connection = memory();
        let token = CancellationToken::new();
        let late = token.clone();
        BEFORE_COMMIT_HOOK.with(|hook| {
            *hook.borrow_mut() = Some(Box::new(move || {
                cancel_on_callback(late, 1);
            }));
        });
        let result = with_sqlite_cancellation_transaction(&mut connection, &token, |connection| {
            connection.batch_execute("DROP INDEX original")?;
            Ok(())
        });
        set_callback_hook(|| {});
        assert!(token.is_cancelled(), "cancel must arrive during COMMIT");
        result.unwrap();
        assert!(crate::db::index_cancellation_tests::index_list(&mut connection).is_empty());
        assert!(!<SqliteConnection as diesel::r2d2::R2D2Connection>::is_broken(&mut connection));
    }

    #[test]
    fn commit_failure_is_preserved_after_late_cancellation() {
        let mut connection = memory();
        connection.batch_execute("PRAGMA foreign_keys = ON; CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED);").unwrap();
        let token = CancellationToken::new();
        let late = token.clone();
        BEFORE_COMMIT_HOOK.with(|hook| {
            *hook.borrow_mut() = Some(Box::new(move || {
                cancel_on_callback(late, 1);
            }));
        });
        let result = with_sqlite_cancellation_transaction(&mut connection, &token, |connection| {
            connection.batch_execute("INSERT INTO child VALUES (1)")?;
            Ok(())
        });
        set_callback_hook(|| {});
        assert!(token.is_cancelled());
        assert!(
            matches!(result, Err(Error::Diesel(error)) if error.to_string() == "FOREIGN KEY constraint failed")
        );
    }

    #[test]
    fn body_error_is_preserved_even_if_token_is_cancelled() {
        let mut connection = memory();
        let before = crate::db::index_cancellation_tests::index_list(&mut connection);
        let token = CancellationToken::new();
        let result: Result<(), Error> =
            with_sqlite_cancellation_transaction(&mut connection, &token, |connection| {
                connection.batch_execute("DROP INDEX original")?;
                token.cancel();
                Err(Error::InvalidInput("body failure".into()))
            });
        assert!(matches!(result, Err(Error::InvalidInput(message)) if message == "body failure"));
        assert_eq!(
            crate::db::index_cancellation_tests::index_list(&mut connection),
            before
        );
    }

    fn database_error(message: &str) -> Error {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(message.to_owned()),
        )
        .into()
    }

    #[test]
    fn only_verified_auto_rollback_is_classified_as_cancellation() {
        const AUTO_ROLLBACK: &str = "cannot rollback - no transaction is active";
        assert!(matches!(
            classify_transaction_outcome::<()>(Err(database_error(AUTO_ROLLBACK)), true),
            Err(Error::Cancellation)
        ));
        for (message, cancelled) in [("out of memory", true), (AUTO_ROLLBACK, false)] {
            let result =
                classify_transaction_outcome::<()>(Err(database_error(message)), cancelled);
            assert!(matches!(result, Err(Error::Diesel(error)) if error.to_string() == message));
        }
        assert_eq!(classify_transaction_outcome(Ok(7), true).unwrap(), 7);
    }
}

#[cfg(all(test, unix))]
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
            repository
                .initialization_connection(&crate::db::test_target(&path), None)
                .unwrap()
        } else if mode == "identity-first-pool" {
            let seed = SqliteConnection::establish(path.to_str().unwrap()).unwrap();
            drop(seed);
            repository
                .database_identity(&crate::db::test_target(&path))
                .unwrap();
            repository
                .initialization_connection(&crate::db::test_target(&path), None)
                .unwrap()
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

    #[test]
    fn pooled_repository_factory_installs_callback_in_isolated_process() {
        crate::db::test_support::run_isolated(
            "db::sqlite_cancellation::tests::pooled_repository_factory_installs_callback_in_isolated_process",
            || exercise_factory("pool"),
        );
    }

    #[test]
    fn pinned_repository_factory_installs_callback_in_isolated_process() {
        crate::db::test_support::run_isolated(
            "db::sqlite_cancellation::tests::pinned_repository_factory_installs_callback_in_isolated_process",
            || exercise_factory("pinned"),
        );
    }

    #[test]
    fn identity_first_pool_factory_installs_callback_in_isolated_process() {
        crate::db::test_support::run_isolated(
            "db::sqlite_cancellation::tests::identity_first_pool_factory_installs_callback_in_isolated_process",
            || exercise_factory("identity-first-pool"),
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
        let mut connection = repository
            .initialization_connection(&crate::db::test_target(&path), None)
            .unwrap();
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
