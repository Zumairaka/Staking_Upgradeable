const { ethers, upgrades } = require('hardhat')

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log(
		`Deploying upgradeable staking contract with the account: ${deployer.address}`
	)

    // '0xA97Ff02f1C9A2b07BB94c5bf85a30ddFedCE40E4' is the address of the
    // upgradeable NFTY token contract in rinkeby testnet
	const Stake = await ethers.getContractFactory('NFTYStakingUpgradeable')
	const stake = await upgrades.deployProxy(
		Stake,
		['0xA97Ff02f1C9A2b07BB94c5bf85a30ddFedCE40E4'],
		{ initializer: 'initialize' }
	)

	await stake.deployed()
	console.log(
		`Deployed the upgradeable staking contract to the address: ${stake.address}`
	)
}

main()
