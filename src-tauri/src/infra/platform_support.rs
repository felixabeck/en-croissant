//! The refusal helpers are pinned by `infra/platform_support/tests.rs`,
//! where their staged-failure record lives.
use crate::error::Error;

fn refusal(subject: &str, verb: &str) -> Error {
    Error::Conflict(format!("{subject} {verb} unsupported on this platform"))
}

pub(crate) fn unsupported(operation: &str) -> Error {
    refusal(operation, "is")
}

pub(crate) fn unsupported_plural(operations: &str) -> Error {
    refusal(operations, "are")
}

pub(crate) fn off_unix_refusal(operation: &str, unix: bool) -> Result<(), Error> {
    if unix {
        Ok(())
    } else {
        Err(unsupported(operation))
    }
}

#[cfg(test)]
mod tests;
