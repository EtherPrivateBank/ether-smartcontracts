// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @custom:security-contact security@etherprivatebank.com.br
contract eReais is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {

    mapping(address => bool) private _isBlacklisted;

    // Events
    event ContractPaused();
    event ContractUnpaused();
    event TokensIssued(address indexed to, uint256 amount);
    event TokensRedeemed(address indexed from, uint256 amount);
    event AddressBlacklisted(address indexed _address, bool _flag);
    event BlackFundsDestroyed(
        address indexed _blacklistAddress,
        uint256 amount
    );

    constructor(
        address defaultAdmin
    ) ERC20("eReais", "EBRL") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit ContractPaused();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused();
    }

    function issue(address to, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!_isBlacklisted[to], "Recipient is blacklisted");
        _mint(to, amount);
        emit TokensIssued(to, amount);
    }

    function redeem(address to, uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(balanceOf(to) >= amount, "Insufficient balance to redeem");
        _burn(to, amount);
        emit TokensRedeemed(to, amount);
    }

    function isBlacklisted(address _address) public view returns (bool) {
        return _isBlacklisted[_address];
    }

    function blacklistAddress(
        address _address,
        bool _flag
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _isBlacklisted[_address] = _flag;
        emit AddressBlacklisted(_address, _flag);
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        require(!_isBlacklisted[from], "Sender is blacklisted");
        require(!_isBlacklisted[to], "Recipient is blacklisted");
        super._update(from, to, value);
    }
}
