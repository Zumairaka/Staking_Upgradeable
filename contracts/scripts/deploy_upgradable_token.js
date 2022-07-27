const { ethers, upgrades } = require('hardhat')

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log(`Deploying NFTY Token with the account: ${deployer.address}`)

	const NFTYToken = await ethers.getContractFactory('NFTYToken')
	console.log('Deploying NFTYToken...')
	const tokenv1 = await upgrades.deployProxy(NFTYToken, {
		initializer: 'initialize',
	})
	await tokenv1.deployed()
	console.log('NFTYToken deployed to:', tokenv1.address)
}

main()
