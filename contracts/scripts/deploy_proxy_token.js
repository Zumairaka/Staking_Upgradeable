const { ethers, upgrades } = require('hardhat')

async function main() {
    const TokenV2 = await ethers.getContractFactory('NFTYtokenUpgraded')
    console.log('Upgrading Token...')
    // 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 will be replaced by the token contract
    const tokenv2 = await upgrades.upgradeProxy(
        '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        TokenV2
    )
    console.log('Token upgraded')
}

main()
