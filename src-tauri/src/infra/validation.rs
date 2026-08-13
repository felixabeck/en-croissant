use crate::error::Error;
#[derive(Debug, Clone, Copy)]
pub struct ValidGameIndex(usize);

impl ValidGameIndex {
    pub fn new(idx: i32) -> Result<Self, Error> {
        if idx < 0 {
            Err(Error::InvalidInput("Invalid game index".into()))
        } else {
            Ok(Self(idx as usize))
        }
    }

    pub fn as_usize(&self) -> usize {
        self.0
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ValidGameRange {
    pub start: usize,
    pub count: usize,
}

impl ValidGameRange {
    pub fn new(start: i32, end: i32) -> Result<Self, Error> {
        if start < 0 || end < start {
            return Err(Error::InvalidInput("Invalid game range".into()));
        }
        let start_u = start as usize;
        let end_u = end as usize;
        let count = end_u
            .checked_sub(start_u)
            .and_then(|c| c.checked_add(1))
            .ok_or_else(|| Error::InvalidInput("Range count overflow".into()))?;
        Ok(Self {
            start: start_u,
            count,
        })
    }
}
