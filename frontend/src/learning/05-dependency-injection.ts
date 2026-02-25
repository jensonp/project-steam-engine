/**
 * =============================================================================
 * ANGULAR DEPENDENCY INJECTION (DI) - LEARNING GUIDE
 * =============================================================================
 * Source: https://angular.dev/essentials/dependency-injection
 *
 * Dependency Injection is a design pattern where a class receives its
 * dependencies from external sources rather than creating them itself.
 * Angular has its own DI framework built in.
 */

// =============================================================================
// 1. WHAT IS DEPENDENCY INJECTION?
// =============================================================================
/**
 * Instead of a class creating its own dependencies:
 *
 * BAD (tight coupling):
 *   class Car {
 *     engine = new Engine();  // Car creates its own engine
 *   }
 *
 * GOOD (dependency injection):
 *   class Car {
 *     constructor(private engine: Engine) {}  // Engine is injected
 *   }
 *
 * Benefits:
 * - Easier testing (can inject mocks)
 * - Loose coupling between classes
 * - Reusable and configurable services
 */

// =============================================================================
// 2. CREATING AN INJECTABLE SERVICE
// =============================================================================
/**
 * Use the @Injectable() decorator to mark a class as injectable.
 * 'providedIn: root' makes it a singleton available app-wide.
 *
 * import { Injectable } from '@angular/core';
 *
 * @Injectable({
 *   providedIn: 'root'
 * })
 * export class UserService {
 *   private users: string[] = [];
 *
 *   addUser(name: string): void {
 *     this.users.push(name);
 *   }
 *
 *   getUsers(): string[] {
 *     return this.users;
 *   }
 * }
 */

// =============================================================================
// 3. INJECTING A SERVICE - TWO APPROACHES
// =============================================================================

// METHOD 1: Constructor Injection (Traditional)
/**
 * @Component({
 *   selector: 'app-user-list',
 *   template: `<ul>@for (user of users; track user) { <li>{{ user }}</li> }</ul>`
 * })
 * export class UserListComponent {
 *   users: string[] = [];
 *
 *   constructor(private userService: UserService) {
 *     this.users = this.userService.getUsers();
 *   }
 * }
 */

// METHOD 2: inject() function (Modern, preferred)
/**
 * import { Component, inject } from '@angular/core';
 *
 * @Component({
 *   selector: 'app-user-list',
 *   template: `<ul>@for (user of users; track user) { <li>{{ user }}</li> }</ul>`
 * })
 * export class UserListComponent {
 *   private userService = inject(UserService);
 *   users = this.userService.getUsers();
 * }
 */

// =============================================================================
// 4. PROVIDER SCOPES
// =============================================================================

// SCOPE 1: Root — Application-wide singleton
/**
 * @Injectable({ providedIn: 'root' })
 * export class GlobalService {}
 */

// SCOPE 2: Component Level — New instance per component
/**
 * @Component({
 *   selector: 'app-example',
 *   providers: [LocalService],
 *   template: `...`
 * })
 * export class ExampleComponent {
 *   private localService = inject(LocalService);
 * }
 */

// =============================================================================
// 5. INJECTION TOKENS (for non-class values)
// =============================================================================
/**
 * import { InjectionToken, inject } from '@angular/core';
 *
 * export const API_URL = new InjectionToken<string>('API_URL');
 *
 * // Provide in app.config.ts:
 * export const appConfig = {
 *   providers: [
 *     { provide: API_URL, useValue: 'https://api.example.com' }
 *   ]
 * };
 *
 * // Inject:
 * @Injectable({ providedIn: 'root' })
 * export class ApiService {
 *   private apiUrl = inject(API_URL);
 * }
 */

// =============================================================================
// 6. PROVIDER TYPES
// =============================================================================
/**
 * providers: [
 *   { provide: Logger, useClass: BetterLogger },           // swap class
 *   { provide: API_URL, useValue: 'https://api.com' },     // static value
 *   { provide: DataService,                                 // factory fn
 *     useFactory: (http: HttpClient) => new DataService(http),
 *     deps: [HttpClient]
 *   },
 *   { provide: OldService, useExisting: NewService }        // alias
 * ]
 */

// =============================================================================
// 7. KEY TAKEAWAYS
// =============================================================================
/**
 * ✅ Use @Injectable({ providedIn: 'root' }) for app-wide singletons
 * ✅ Prefer inject() function over constructor injection
 * ✅ Services are great for:
 *    - Sharing data between components
 *    - Encapsulating business logic
 *    - Making HTTP calls
 *    - Managing application state
 * ✅ Use InjectionToken for non-class dependencies
 * ✅ Component-level providers create new instances per component
 */

export {};
