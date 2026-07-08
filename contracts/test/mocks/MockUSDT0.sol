// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Test-only stand-in for USD-T0. Deliberately non-standard like real USDT: transfer,
///      transferFrom and approve return NOTHING (no bool). This is what forces the escrow to
///      go through SafeERC20; a token that returned bool would not exercise that path.
///      This mock exists solely for `forge test` against a local EVM. The product deposits real
///      USD-T0 on testnet, never this. 6 decimals to match USDT.
contract MockUSDT0 {
    string public constant name = "Mock USD-T0";
    string public constant symbol = "USDT0";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
    }

    function transfer(address to, uint256 amount) external {
        _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "insufficient balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}
