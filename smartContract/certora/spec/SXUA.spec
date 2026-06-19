// SXUA.spec

methods {
    depositWithSplit(address, uint256, uint256) envfree
    withdraw(uint256, uint256) envfree
    accrueYield(uint256) envfree
}

// 1. Yield Accrual Logic Integrity
// Yield should only be added if time has elapsed
rule yieldRequiresTime(uint256 index) {
    env e;
    
    // ... setup and capture state ...
    // accrueYield(index);
    // ... assert state ...
}

// 2. Penalty Integrity
// Early withdrawal must incur 10% penalty
rule penaltyAppliedOnEarlyWithdraw(uint256 index, uint256 amount) {
    env e;
    // ... setup assumption: block.timestamp < lock_duration ...
    // withdraw@withrevert(e, index, amount);
    // ... assert penalty event emitted or balance reduced by penalty ...
}

// 3. No Reentrancy
// Ensured by ReentrancyGuard, but Certora can prove no reentrant path modifies state maliciously.
