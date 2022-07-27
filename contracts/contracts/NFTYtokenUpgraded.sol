// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract NFTYtokenUpgraded is ERC20Upgradeable, OwnableUpgradeable {
    uint256 private mybalance;

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function burn(uint256 amount) external onlyOwner {
        _burn(_msgSender(), amount);
    }

    function burnFromAccount(address account, uint256 amount) external {
        require(
            _msgSender() == account,
            "NFTYtokenUpgraded: permission denied"
        );
        require(
            balanceOf(account) >= amount,
            "NFTYtokenUpgraded: not enough balance"
        );
        _burn(account, amount);
    }

    function getMyBalance() external view returns(uint256) {
        return mybalance;
    }
}
