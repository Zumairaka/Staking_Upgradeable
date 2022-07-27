const { ethers, upgrades } = require('hardhat')

async function main() {
	const StakeUpgraded = await ethers.getContractFactory(
		'NFTYStakingUpgradeableTest'
	)

    // copy the current staking contract address to the 
	// currentStakingAddress field
    const currentStakingAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
	console.log('Deploying proxy staking contract...')

    const stakeUpgraded = await upgrades.upgradeProxy(
		currentStakingAddress,
		StakeUpgraded
	)
    console.log('Updated Staking Contract')
}

main()
