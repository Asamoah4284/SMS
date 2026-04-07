const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  console.log('Testing database connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL)
  
  const prisma = new PrismaClient()
  
  try {
    await prisma.$connect()
    console.log('✅ Database connected successfully!')
    
    // Try to query
    const result = await prisma.$queryRaw`SELECT 1+1 as result`
    console.log('✅ Query successful:', result)
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

require('dotenv').config()
testConnection()