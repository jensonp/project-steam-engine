/**
 * Generic Angular module mock
 * Exports empty objects for any Angular submodule
 */

export const CommonModule = {};
export const FormsModule = {};
export const RouterModule = {};
export const BrowserModule = {};
export const HttpClientModule = {};

export class Router {
  navigate = jest.fn().mockResolvedValue(true);
  getCurrentNavigation = jest.fn().mockReturnValue(null);
}

export const RouterLink = {};
export const RouterLinkWithHref = {};
export const RouterOutlet = {};

export const ActivatedRoute = {
  snapshot: {
    params: {},
    queryParams: {},
  }
};

export default {};
