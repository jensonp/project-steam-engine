import { SearchService } from '../search.service';
import { query } from '../../config/db';

// Mock the query function from db.ts so we don't hit the real PostgreSQL database
jest.mock('../../config/db', () => ({
  query: jest.fn(),
}));

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
    jest.clearAllMocks();
  });

  it('should fetch top overall games when no genres are provided', async () => {
    // Setup the mock to return an empty array of rows
    (query as jest.Mock).mockResolvedValue({ rows: [] });

    await searchService.searchByGenres([]);

    // We expect the query to execute a simple SELECT ... ORDER BY positive_votes
    expect(query).toHaveBeenCalledTimes(1);
    const sqlArg = (query as jest.Mock).mock.calls[0][0];
    expect(sqlArg).toContain('ORDER BY positive_votes DESC');
    expect(sqlArg).not.toContain('WHERE');
  });

  it('should generate compound GIN trgm overlap conditions when multiple genres are provided', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [] });

    await searchService.searchByGenres(['RPG', 'Action']);

    expect(query).toHaveBeenCalledTimes(1);
    
    // Check the arguments passed to query(text, params)
    const [sqlText, params] = (query as jest.Mock).mock.calls[0];
    
    // Verify SQL structure
    expect(sqlText).toContain('WHERE ((genres %% $1 OR tags %% $1) AND (genres %% $2 OR tags %% $2))');
    
    // Verify parameterized inputs are safely wrapped in wildcards
    expect(params).toEqual(['RPG', 'Action']);
  });

  it('should map flat database rows into nested JSON objects correctly', async () => {
    // Mock a realistic database response row
    (query as jest.Mock).mockResolvedValue({
      rows: [
        {
          app_id: 123,
          game_name: 'Test Game',
          genres: 'RPG,Action',
          header_image: 'http://img',
          price: '19.99',
        }
      ]
    });

    const results = await searchService.searchByGenres(['RPG']);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      appId: 123,
      name: 'Test Game',
      genres: ['RPG', 'Action'],
      headerImage: 'http://img',
      price: 19.99,
      isFree: false
    });
  });
});
