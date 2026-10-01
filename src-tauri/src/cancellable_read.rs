//! Cancellation observable inside a single `pgn_reader::BufferedReader::read_game`
//! call. The parser may issue many reads for one large game or a long stretch
//! without a game boundary, so checking only between games would leave a
//! cancelled request occupying the bounded blocking gateway unnecessarily long.

use std::io::{self, Read};

use tokio_util::sync::CancellationToken;

use crate::error::Error;

/// Tracks decompressed bytes delivered to the parser and failures from below it.
/// The byte count is the decompressed-stream offset, not a compressed file offset.
/// Keep this inside `CancellableRead` so cancellation is not recorded as source I/O.
#[derive(Default)]
pub(crate) struct SourceReadState {
    pub bytes_read: std::cell::Cell<u64>,
    pub failed: std::cell::Cell<bool>,
}

pub(crate) struct SourceRead<'a, R> {
    inner: R,
    state: &'a SourceReadState,
}

impl<'a, R> SourceRead<'a, R> {
    pub(crate) fn new(inner: R, state: &'a SourceReadState) -> Self {
        Self { inner, state }
    }
}

impl<R: Read> Read for SourceRead<'_, R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        match self.inner.read(buffer) {
            Ok(bytes) => {
                self.state
                    .bytes_read
                    .set(self.state.bytes_read.get() + bytes as u64);
                Ok(bytes)
            }
            Err(error) => {
                self.state.failed.set(true);
                Err(error)
            }
        }
    }
}

pub struct CancellableRead<R> {
    inner: R,
    cancellation: CancellationToken,
}

impl<R> CancellableRead<R> {
    pub fn new(inner: R, cancellation: &CancellationToken) -> Self {
        Self {
            inner,
            cancellation: cancellation.clone(),
        }
    }
}

impl<R: Read> Read for CancellableRead<R> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if self.cancellation.is_cancelled() {
            return Err(io::Error::new(
                io::ErrorKind::Interrupted,
                "PGN read cancelled",
            ));
        }
        self.inner.read(buffer)
    }
}

/// Maps the interruption a cancelled reader produced to `Error::Cancellation`;
/// every other read failure, including an unrelated interruption, stays I/O.
pub fn map_read_error(error: io::Error, cancellation: &CancellationToken) -> Error {
    if error.kind() == io::ErrorKind::Interrupted && cancellation.is_cancelled() {
        Error::Cancellation
    } else {
        error.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_through_until_cancelled_then_interrupts() {
        let token = CancellationToken::new();
        let mut reader = CancellableRead::new(&b"abcd"[..], &token);
        let mut buffer = [0; 2];
        assert_eq!(reader.read(&mut buffer).unwrap(), 2);
        assert_eq!(&buffer, b"ab");
        token.cancel();
        let error = reader.read(&mut buffer).expect_err("cancelled read");
        assert_eq!(error.kind(), io::ErrorKind::Interrupted);
        assert!(matches!(map_read_error(error, &token), Error::Cancellation));
    }

    #[test]
    fn only_a_cancelled_interruption_maps_to_cancellation() {
        let live = CancellationToken::new();
        let cancelled = CancellationToken::new();
        cancelled.cancel();
        let interrupted = || io::Error::new(io::ErrorKind::Interrupted, "unrelated");
        assert!(matches!(
            map_read_error(interrupted(), &live),
            Error::Io(ref source) if source.kind() == io::ErrorKind::Interrupted
        ));
        assert!(matches!(
            map_read_error(io::Error::from(io::ErrorKind::InvalidData), &cancelled),
            Error::Io(ref source) if source.kind() == io::ErrorKind::InvalidData
        ));
    }
}
