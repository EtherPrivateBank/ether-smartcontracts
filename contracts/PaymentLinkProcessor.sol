// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./eReais.sol";

contract PaymentLinkProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;
    uint256 public treasurySplitRate;

    enum PaymentStatus {
        Pending,
        Paid,
        Failed
    }

    struct PaymentLink {
        string uuid;
        uint256 amount;
        uint256 interestRate;
        uint256 spreadRate;
        PaymentStatus status;
        address customerAddress;
        address beneficiary;
    }

    mapping(string => PaymentLink) public paymentLinks;
    mapping(uint256 => uint256) public interestRates;
    mapping(uint256 => uint256) public spreadRates;

    event PaymentLinkCreated(
        string uuid,
        uint256 amount,
        uint256 interestRate,
        uint256 spreadRate,
        address indexed customer,
        address indexed beneficiary
    );
    event PaymentProcessed(string uuid, PaymentStatus status);
    event TokensMinted(string uuid, address indexed customer, uint256 amount);

    constructor(address _eBRLAddress, address admin, address _treasuryWallet, uint256 _treasurySplitRate) {
        require(_treasurySplitRate <= 100, "Treasury split rate must be between 0 and 100");
        eBRLContract = eReais(_eBRLAddress);
        treasuryWallet = _treasuryWallet;
        treasurySplitRate = _treasurySplitRate;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setInterestRate(
        uint256 installments,
        uint256 rate
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interestRates[installments] = rate;
    }

    function setSpreadRate(
        uint256 installments,
        uint256 rate
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        spreadRates[installments] = rate;
    }

    function createPaymentLink(
        string memory _uuid,
        uint256 _amount,
        uint256 _installments,
        address _customer,
        address _beneficiary
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _installments > 0 && _installments <= 21,
            "Invalid number of installments"
        );
        uint256 interestRate = interestRates[_installments];
        uint256 spreadRate = spreadRates[_installments];

        paymentLinks[_uuid] = PaymentLink({
            uuid: _uuid,
            amount: _amount,
            interestRate: interestRate,
            spreadRate: spreadRate,
            status: PaymentStatus.Pending,
            customerAddress: _customer,
            beneficiary: _beneficiary
        });

        emit PaymentLinkCreated(
            _uuid,
            _amount,
            interestRate,
            spreadRate,
            _customer,
            _beneficiary
        );
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
            uint256 interestAmount = calculateInstallmentFee(
                link.amount,
                link.interestRate
            );
            uint256 spreadAmount = calculateInstallmentFee(
                link.amount,
                link.spreadRate
            );
            uint256 treasuryAmount = (spreadAmount * treasurySplitRate) / 100;
            uint256 beneficiaryAmount = spreadAmount - treasuryAmount;

            uint256 netAmount = link.amount - interestAmount - spreadAmount;
            eBRLContract.issue(link.customerAddress, netAmount);
            eBRLContract.issue(treasuryWallet, treasuryAmount);
            eBRLContract.issue(link.beneficiary, beneficiaryAmount);

            link.status = PaymentStatus.Paid;
            emit TokensMinted(_uuid, link.customerAddress, netAmount);
        } else {
            paymentLinks[_uuid].status = PaymentStatus.Failed;
        }

        emit PaymentProcessed(_uuid, paymentLinks[_uuid].status);
    }

    function calculateInstallmentFee(
        uint256 _amount,
        uint256 _percentageBasisPoints
    ) public pure returns (uint256) {
        return (_amount * _percentageBasisPoints) / 10000;
    }
}
