const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');

class PlaidService {
  constructor() {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });

    this.client = new PlaidApi(configuration);
  }

  // Create a link token for Plaid Link
  async createLinkToken(userId) {
    try {
      console.log('Creating link token with config:');
      console.log('- Client ID:', process.env.PLAID_CLIENT_ID ? 'Set' : 'MISSING');
      console.log('- Secret:', process.env.PLAID_SECRET ? 'Set' : 'MISSING');
      console.log('- Environment:', process.env.PLAID_ENV);
      
      const request = {
        user: {
          client_user_id: userId,
        },
        client_name: 'Financial SuperApp',
        products: ['transactions', 'auth'], // Fixed product names
        country_codes: ['US', 'CA'],
        language: 'en',
      };

      console.log('Link token request:', JSON.stringify(request, null, 2));

      const response = await this.client.linkTokenCreate(request);
      console.log('Link token created successfully');
      return response.data;
    } catch (error) {
      console.error('Detailed Plaid error:');
      console.error('- Status:', error.response?.status);
      console.error('- Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('- Message:', error.message);
      throw error;
    }
  }

  // Exchange public token for access token
  async exchangePublicToken(publicToken) {
    try {
      const request = {
        public_token: publicToken,
      };

      // CORRECT method name
      const response = await this.client.itemPublicTokenExchange(request);
      return response.data;
    } catch (error) {
      console.error('Plaid exchangePublicToken error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get user accounts
  async getAccounts(accessToken) {
    try {
      const request = {
        access_token: accessToken,
      };

      const response = await this.client.accountsGet(request);
      return response.data;
    } catch (error) {
      console.error('Plaid getAccounts error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get account balances
  async getBalances(accessToken) {
    try {
      const request = {
        access_token: accessToken,
      };

      const response = await this.client.accountsBalanceGet(request);
      return response.data;
    } catch (error) {
      console.error('Plaid getBalances error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get transactions - FIXED VERSION
  async getTransactions(accessToken, startDate = null, endDate = null) {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate || new Date();

      const request = {
        access_token: accessToken,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
        // Removed count and offset - these are not valid for this endpoint
      };

      console.log('Getting transactions with request:', request);

      const response = await this.client.transactionsGet(request);
      return response.data;
    } catch (error) {
      console.error('Plaid getTransactions error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get institution info
  async getInstitution(institutionId) {
    try {
      const request = {
        institution_id: institutionId,
        country_codes: ['US', 'CA'],
      };

      const response = await this.client.institutionsGetById(request);
      return response.data;
    } catch (error) {
      console.error('Plaid getInstitution error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get item (connection info)
  async getItem(accessToken) {
    try {
      const request = {
        access_token: accessToken,
      };

      const response = await this.client.itemGet(request);
      return response.data;
    } catch (error) {
      console.error('Plaid getItem error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = PlaidService;
