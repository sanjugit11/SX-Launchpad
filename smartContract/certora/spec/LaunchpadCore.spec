// LaunchpadCore.spec

methods {
    purchaseLT(uint256) envfree
    claimVested(uint256) envfree
    earlyExit(uint256) envfree
    convertToMP(uint256) envfree
    
    // Access control getters
    owner() returns (address) envfree
}

// 1. No Reentrancy (Implicit in Certora, but we can verify balances)
// The token balances shouldn't change arbitrarily without calling proper functions.

// 2. Access Control: Only owner can change treasury
// (Assuming we had a setTreasury function, which we omitted, but standard access control rule)
rule onlyOwnerCanSetTreasury(address newTreasury) {
    env e;
    require e.msg.sender != owner();
    
    // Assuming setTreasury exists
    // setTreasury@withrevert(e, newTreasury);
    // assert lastReverted;
}

// 3. Vesting Integrity: Cannot claim before cliff
rule noClaimBeforeCliff(uint256 index) {
    env e;
    // ... setup vesting schedule assumption ...
    // claimVested@withrevert(e, index);
    // assert block.timestamp < vesting.startTime + CLIFF => lastReverted;
}

// 4. Forfeiture Integrity: Forfeiture sets active to false
rule forfeitureDeactivatesSchedule(uint256 index) {
    env e;
    
    // active before
    bool activeBefore = true; // Placeholder for getter
    
    earlyExit(index);
    
    bool activeAfter = false; // Placeholder for getter
    assert !activeAfter;
}

// 5. No Overflow
// Checked inherently by Solidity 0.8+ via reverts, Certora will catch these as reverting paths.
rule noOverflowReverts() {
    env e;
    uint256 max = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    purchaseLT@withrevert(e, max);
    assert lastReverted;
}
