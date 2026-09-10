use std::{
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

const ISOLATED_TEST_ENV: &str = "CHESSFABLE_DB_ISOLATED_TEST";

struct OwnedChild(Option<Child>);

impl Drop for OwnedChild {
    fn drop(&mut self) {
        if let Some(mut child) = self.0.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub(super) fn run_isolated(test_name: &str, child_body: impl FnOnce()) {
    if std::env::var(ISOLATED_TEST_ENV).as_deref() == Ok(test_name) {
        child_body();
        return;
    }

    let child = Command::new(std::env::current_exe().expect("current test executable"))
        .args(["--exact", test_name, "--nocapture"])
        .env(ISOLATED_TEST_ENV, test_name)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("start isolated test subprocess");
    let mut owned = OwnedChild(Some(child));
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        let status = owned
            .0
            .as_mut()
            .expect("owned child")
            .try_wait()
            .expect("wait for isolated test subprocess");
        if let Some(status) = status {
            owned.0.take();
            assert!(status.success(), "isolated test subprocess failed");
            return;
        }
        assert!(
            Instant::now() < deadline,
            "isolated test subprocess timed out after 30 seconds"
        );
        std::thread::sleep(Duration::from_millis(10));
    }
}
