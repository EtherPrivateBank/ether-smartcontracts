// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./eReais.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BrCodesPaymentProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    enum PixStatus {
        Created,
        Paid
    }

    struct Pix {
        string id;
        uint256 amount;
        uint256 fee;
        PixStatus status;
        address customerAddress;
    }

    mapping(string => Pix) private pixTransactions;

    event PixRegistered(
        string id,
        uint256 amount,
        uint256 fee,
        address customerAddress
    );

    event PixPaid(string id, uint256 amount, uint256 fee, address payerAddress);

    event PixStatusUpdatedAndMinted(
        string id,
        uint256 netAmount,
        uint256 fee,
        address customerAddress
    );

    constructor(
        address eBRLAddress,
        address defaultAdmin,
        address _treasuryWallet
    ) {
        eBRLContract = eReais(eBRLAddress);
        treasuryWallet = _treasuryWallet;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function registerPix(
        string memory _id,
        uint256 _amount,
        uint256 _fee,
        address _customerAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amount > _fee, "Amount must be greater than fee");
        pixTransactions[_id] = Pix(
            _id,
            _amount,
            _fee,
            PixStatus.Created,
            _customerAddress
        );
        emit PixRegistered(_id, _amount, _fee, _customerAddress);
    }

    function processPixPayment(
        string memory _id
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Pix storage pix = pixTransactions[_id];
        require(
            pix.status == PixStatus.Created,
            "Pix must be in Created status"
        );

        uint256 netAmount = pix.amount - pix.fee;
        eBRLContract.issue(pix.customerAddress, netAmount);
        eBRLContract.issue(treasuryWallet, pix.fee);

        pix.status = PixStatus.Paid;
        emit PixStatusUpdatedAndMinted(
            _id,
            netAmount,
            pix.fee,
            pix.customerAddress
        );
    }

    function processUnregisteredPixPayment(
        string memory _id,
        uint256 _amount,
        uint256 _fee,
        address _customerAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Pix storage pix = pixTransactions[_id];
        require(pix.status != PixStatus.Paid, "Pix is already paid");
        require(_amount >= _fee, "Amount must be less than fee");

        pixTransactions[_id] = Pix(
            _id,
            _amount,
            _fee,
            PixStatus.Paid,
            _customerAddress
        );

        uint256 netAmount = _amount - _fee;
        eBRLContract.issue(_customerAddress, netAmount);
        eBRLContract.issue(treasuryWallet, _fee);

        emit PixRegistered(_id, _amount, _fee, _customerAddress);
        emit PixStatusUpdatedAndMinted(_id, netAmount, _fee, _customerAddress);
    }

    function payPix(
        string memory _id,
        address payerAddress,
        uint256 amount,
        uint256 fee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Pix storage pix = pixTransactions[_id];
        require(
            pix.status == PixStatus.Created,
            "Pix must be in Created status"
        );
        require(
            eBRLContract.balanceOf(payerAddress) >= amount,
            "Insufficient balance to pay Pix"
        );

        uint256 netAmount = amount + fee;

        eBRLContract.redeem(payerAddress, netAmount);
        eBRLContract.issue(treasuryWallet, fee);

        pix.status = PixStatus.Paid;
        emit PixPaid(_id, amount, fee, payerAddress);
    }

    function getPixDetails(string memory _id) public view returns (Pix memory) {
        return pixTransactions[_id];
    }
}
