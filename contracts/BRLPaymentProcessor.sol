// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./eReais.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BRLPaymentProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    event DepositProcessed(
        address indexed customer,
        uint256 amount,
        string paymentId,
        string eventType,
        uint256 fee
    );

    event WithdrawProcessed(
        address indexed customer,
        uint256 amount,
        string paymentId,
        string eventType,
        uint256 fee
    );

    event EBRLContractUpdated(address newEBRLAddress);
    event TreasuryWalletUpdated(address newTreasuryWallet);

    constructor(
        address eBRLAddress,
        address defaultAdmin,
        address minter,
        address burner,
        address _treasuryWallet
    ) {
        eBRLContract = eReais(eBRLAddress);
        treasuryWallet = _treasuryWallet;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(eBRLContract.MINTER_ROLE(), minter);
        _grantRole(eBRLContract.BURNER_ROLE(), burner);
    }

    function processDeposit(
        address customer,
        uint256 amount,
        string memory paymentId,
        string memory eventType,
        uint256 fee
    ) external onlyRole(eBRLContract.MINTER_ROLE()) {
        uint256 netAmount = amount - fee;
        eBRLContract.issue(customer, netAmount);
        eBRLContract.issue(treasuryWallet, fee);
        emit DepositProcessed(customer, netAmount, paymentId, eventType, fee);
    }

    function processWithdraw(
        address customer,
        uint256 amount,
        string memory paymentId,
        string memory eventType,
        uint256 fee
    ) external onlyRole(eBRLContract.BURNER_ROLE()) {
        uint256 grossAmount = amount + fee;
        eBRLContract.redeem(customer, grossAmount);
        eBRLContract.issue(treasuryWallet, fee);
        emit WithdrawProcessed(customer, amount, paymentId, eventType, fee);
    }

    function setEBRLContract(
        address _newEBRLAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        eBRLContract = eReais(_newEBRLAddress);
        emit EBRLContractUpdated(_newEBRLAddress);
    }

    function setTreasuryWallet(
        address _newTreasuryWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasuryWallet = _newTreasuryWallet;
        emit TreasuryWalletUpdated(_newTreasuryWallet);
    }
}
