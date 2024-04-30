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

    mapping(uint256 => uint256) public installmentFees;

    constructor(address _eBRLAddress, address admin, address _treasuryWallet) {
        eBRLContract = eReais(_eBRLAddress);
        treasuryWallet = _treasuryWallet;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setInstallmentFee(
        uint256 _installments,
        uint256 _feePercentageBasisPoints
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _installments > 0 && _installments <= 21,
            "Invalid number of installments"
        );
        installmentFees[_installments] = _feePercentageBasisPoints;
    }

    function createPaymentLink(
        string memory _uuid,
        uint256 _amount,
        uint256 _installments,
        address _customer
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _installments > 0 && _installments <= 21,
            "Invalid number of installments"
        );
        uint256 feePercentage = installmentFees[_installments];
        uint256 fee = calculateInstallmentFee(_amount, feePercentage);

        paymentLinks[_uuid] = PaymentLink({
            uuid: _uuid,
            amount: _amount,
            fee: fee,
            status: PaymentStatus.Pending,
            customerAddress: _customer
        });

        emit PaymentLinkCreated(_uuid, _amount, fee, _customer);
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
            uint256 netAmount = link.amount;
            if (link.fee > 0) {
                netAmount = link.amount - link.fee;
            }
            eBRLContract.issue(link.customerAddress, netAmount);
            if (link.fee > 0) {
                eBRLContract.issue(treasuryWallet, link.fee);
            }
            link.status = PaymentStatus.Paid;
            emit TokensMinted(_uuid, link.customerAddress, netAmount);
        } else {
            paymentLinks[_uuid].status = PaymentStatus.Failed;
        }

        emit PaymentProcessed(_uuid, paymentLinks[_uuid].status);
    }

    function calculateInstallmentFee(
        uint256 _amount,
        uint256 _feePercentageBasisPoints
    ) public pure returns (uint256) {
        return (_amount * _feePercentageBasisPoints) / 10000;
    }
}
