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
        string[] tags;
        PixStatus status;
        address customerAddress;
        string pictureUrl;
    }

    mapping(string => Pix) private pixTransactions;

    event PixRegistered(
        string id,
        uint256 amount,
        uint256 fee,
        address customerAddress,
        string pictureUrl
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
        string[] memory _tags,
        address _customerAddress,
        string memory _pictureUrl
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amount > _fee, "Amount must be greater than fee");
        pixTransactions[_id] = Pix(
            _id,
            _amount,
            _fee,
            _tags,
            PixStatus.Created,
            _customerAddress,
            _pictureUrl
        );
        emit PixRegistered(_id, _amount, _fee, _customerAddress, _pictureUrl);
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
        address _customerAddress,
        string[] memory _tags,
        string memory _pictureUrl
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_amount > _fee, "Amount must be less than fee");

        pixTransactions[_id] = Pix(
            _id,
            _amount,
            _fee,
            _tags,
            PixStatus.Paid,
            _customerAddress,
            _pictureUrl
        );

        uint256 netAmount = _amount - _fee;
        eBRLContract.issue(_customerAddress, netAmount);
        eBRLContract.issue(treasuryWallet, _fee);

        emit PixRegistered(_id, _amount, _fee, _customerAddress, _pictureUrl);
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

        eBRLContract.issue(treasuryWallet, fee);
        eBRLContract.redeem(payerAddress, amount);

        pix.status = PixStatus.Paid;
        emit PixPaid(_id, amount, fee, payerAddress);
    }

    function getPixDetails(string memory _id) public view returns (Pix memory) {
        return pixTransactions[_id];
    }
}
