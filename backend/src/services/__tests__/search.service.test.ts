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
    expect(sqlText).toContain('WHERE ((genres % $1 OR tags % $1) AND (genres % $2 OR tags % $2))');
    
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

  it('should include OS support clause when os filter is provided', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [] });

    await searchService.searchByGenres([], '', '', 'windows');

    expect(query).toHaveBeenCalledTimes(1);
    const [sqlText, params] = (query as jest.Mock).mock.calls[0];
    expect(sqlText).toContain('WHERE windows_support = TRUE');
    expect(params).toEqual([]);
  });

  it('should retry search without OS filter when support columns are missing', async () => {
    (query as jest.Mock)
      .mockRejectedValueOnce({ code: '42703', message: 'column "mac_support" does not exist' })
      .mockResolvedValueOnce({ rows: [] });

    await searchService.searchByGenres([], 'aaa', '', 'mac');

    expect(query).toHaveBeenCalledTimes(2);
    const [firstSql] = (query as jest.Mock).mock.calls[0];
    const [secondSql] = (query as jest.Mock).mock.calls[1];
    expect(firstSql).toContain('mac_support = TRUE');
    expect(secondSql).not.toContain('mac_support = TRUE');
  });

  it('should collapse alias app IDs that resolve to the same canonical Steam app', async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [
        {
          app_id: 10180,
          game_name: 'Call of Duty®: Modern Warfare® 2 (2009)',
          genres: 'Action',
          header_image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/10180/header.jpg',
          price: '14.99',
        },
        {
          app_id: 10190,
          game_name: 'Call of Duty®: Modern Warfare® 2 (2009)',
          genres: 'Action',
          header_image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/10180/header.jpg',
          price: '14.99',
        },
      ],
    });

    const results = await searchService.searchByGenres(['Action']);
    expect(results).toHaveLength(1);
    expect(results[0].appId).toBe(10180);
  });
});
