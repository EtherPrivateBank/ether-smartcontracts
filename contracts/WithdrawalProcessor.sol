// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./eReais.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract WithdrawalProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    enum Status {
        Pending,
        Approved,
        Cancelled
    }

    struct WithdrawalRequest {
        uint256 amount;
        uint256 fee;
        address user;
        Status status;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    event WithdrawalRequested(
        uint256 requestId,
        address indexed user,
        uint256 amount
    );
    event WithdrawalApproved(uint256 requestId, uint256 netAmount);
    event WithdrawalCancelled(uint256 requestId);

    constructor(
        address eBRLAddress,
        address defaultAdmin,
        address treasury
    ) {
        eBRLContract = eReais(eBRLAddress);
        treasuryWallet = treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);

    }

    function requestWithdrawal(
        uint256 requestId,
        address user,
        uint256 amount,
        uint256 fee
    ) external {
        require(amount > 0, "Amount must be greater than zero");
        require(eBRLContract.balanceOf(user) >= amount, "Insufficient balance");

        withdrawalRequests[requestId] = WithdrawalRequest({
            amount: amount,
            fee: fee,
            user: user,
            status: Status.Pending
        });

        emit WithdrawalRequested(requestId, user, amount);
    }

    function approveWithdrawal(
        uint256 requestId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.status == Status.Pending, "Withdrawal not pending");

        uint256 netAmount = request.amount - request.fee;
        require(netAmount > 0, "Net amount must be positive after fees");
        require(
            eBRLContract.balanceOf(request.user) >= request.amount,
            "Insufficient balance"
        );

        request.status = Status.Approved;
        eBRLContract.redeem(request.user, netAmount);
        eBRLContract.issue(treasuryWallet, request.fee);

        emit WithdrawalApproved(requestId, netAmount);
    }

    function cancelWithdrawal(
        uint256 requestId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.status == Status.Pending, "Withdrawal not pending");

        request.status = Status.Cancelled;
        emit WithdrawalCancelled(requestId);
    }
}
