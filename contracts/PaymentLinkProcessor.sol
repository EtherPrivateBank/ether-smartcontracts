// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./eReais.sol";

contract PaymentLinkProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    enum PaymentStatus {
        Pending,
        Paid,
        Failed
    }

    struct PaymentLink {
        string uuid;
        uint256 amount;
        uint256 fee;
        PaymentStatus status;
        address customerAddress;
    }

    mapping(string => PaymentLink) public paymentLinks;

    event PaymentLinkCreated(
        string uuid,
        uint256 amount,
        uint256 fee,
        address indexed customer
    );
    event PaymentProcessed(string uuid, PaymentStatus status);
    event TokensMinted(string uuid, address indexed customer, uint256 amount);

    constructor(address _eBRLAddress, address admin, address _treasuryWallet) {
        eBRLContract = eReais(_eBRLAddress);
        treasuryWallet = _treasuryWallet;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createPaymentLink(
        string memory _uuid,
        uint256 _amount,
        uint256 _fee,
        address _customer
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        paymentLinks[_uuid] = PaymentLink({
            uuid: _uuid,
            amount: _amount,
            fee: _fee,
            status: PaymentStatus.Pending,
            customerAddress: _customer
        });
        emit PaymentLinkCreated(_uuid, _amount, _fee, _customer);
    }

    function processPayment(
        string memory _uuid,
        bool _success
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            paymentLinks[_uuid].status == PaymentStatus.Pending,
            "Payment already processed"
        );

        if (_success) {
            PaymentLink storage link = paymentLinks[_uuid];
            uint256 netAmount = link.amount - link.fee;
            eBRLContract.issue(link.customerAddress, netAmount);
            eBRLContract.issue(treasuryWallet, link.fee);

            link.status = PaymentStatus.Paid;
            emit TokensMinted(_uuid, link.customerAddress, netAmount);
        } else {
            paymentLinks[_uuid].status = PaymentStatus.Failed;
        }

        emit PaymentProcessed(_uuid, paymentLinks[_uuid].status);
    }
}
