const { expect } = require('chai')
const { ethers, upgrades } = require('hardhat')

describe('NFTY ERC-20 upgraded token contract', () => {
	let NFTY, NFTYupgraded, nfty, nftyUpgraded

	beforeEach(async () => {
		NFTY = await ethers.getContractFactory('NFTYToken')
		nfty = await upgrades.deployProxy(NFTY)
		await nfty.deployed()

		NFTYupgraded = await ethers.getContractFactory('NFTYtokenUpgraded')
		nftyUpgraded = await upgrades.upgradeProxy(nfty.address, NFTYupgraded)
	})

	describe('Meta Data', () => {
		it('Should return the values of meta data from the initial contract', async () => {
			let name = 'NFTY Token'
			let symbol = 'NFTY'
			let decimal = 18

			expect(await nftyUpgraded.name()).to.equal(name)
			expect(await nftyUpgraded.symbol()).to.equal(symbol)
			expect(await nftyUpgraded.decimals()).to.equal(decimal)
		})
	})
})
