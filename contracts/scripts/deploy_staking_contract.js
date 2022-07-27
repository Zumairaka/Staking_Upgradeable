const { ethers } = require('hardhat')

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log(
		`Deploying Staking smart contract with the account: ${deployer.address}`
	)

	const NFTYStaking = await ethers.getContractFactory('NFTYStaking')
	console.log('Deploying NFTY Staking contract...')
	const nftyStaking = await NFTYStaking.deploy(
		'0x7da460f615104191f57b63d7c033a9889ad6c3c9'
	)

	console.log(`Deployed NFTY Staking contract to: ${nftyStaking.address}`)
}

main()
