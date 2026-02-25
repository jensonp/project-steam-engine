---
description: Comprehensive Angular tutorial with hands-on practice
---

# Learn Angular: From Zero to Hero

Welcome! This workflow will guide you through learning Angular by building features directly in this project. We will cover Components, Templates, Signals, Control Flow, and Services.

## Chapter 1: Components & Structure

**Goal**: Understand the anatomy of an Angular Component and create your first one.

1.  **Inspect the Root Component**:
    - Open [frontend/src/app/app.ts](file:///Users/jensonphan/cs125/frontend/src/app/app.ts)
    - Note the `@Component` decorator. It defines the `selector`, `standalone: true`, `imports`, and `templateUrl`.
    - This is the entry point of your app's UI.

2.  **Create a New Component**:
    - We will create a `UserProfile` component.
    - Run the command below:
      // turbo
    - `ng generate component user-profile` (in `frontend` directory)

3.  **Verify Creation**:
    - Check that `frontend/src/app/user-profile/` exists.
    - Open `user-profile.component.ts` and see how it looks similar to `app.ts`.

4.  **Use It**:
    - Open `app.ts` and add `UserProfileComponent` to the `imports` array.
    - Open `app.html` and add `<app-user-profile></app-user-profile>` at the bottom.
    - Run `npm start` (if not running) and check your browser!

## Chapter 2: Template Syntax

**Goal**: Learn how to display dynamic data and handle user events.

1.  **Interpolation {{ }}**:
    - In `user-profile.component.ts`, add a property: `username = 'Jenson';` inside the class.
    - In `user-profile.component.html`, add: `<h2>Hello, {{ username }}!</h2>`

2.  **Property Binding [ ]**:
    - Add a property: `avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jenson';`
    - In HTML: `<img [src]="avatarUrl" alt="User Avatar" width="100">`
    - Notice the `[]` around `src`. This binds the _property_ `src` to the _variable_ `avatarUrl`.

3.  **Event Binding ( )**:
    - Add a method: `greet() { alert('Hello!'); }`
    - In HTML: `<button (click)="greet()">Say Hi</button>`
    - Notice the `()` around `click`. This binds the _event_ `click` to the _function_ `greet()`.

## Chapter 3: Signals (Modern Reactivity)

**Goal**: Use Angular Signals for fine-grained reactivity.

1.  **Upgrade to Signals**:
    - In `user-profile.component.ts`, import `signal` from `@angular/core`.
    - Change `username` to: `username = signal('Jenson');`
    - Update HTML: `{{ username() }}` (Note the parenthesis! tailored for reading signals).

2.  **Update Signal**:
    - Add a method: `updateName() { this.username.set('Antigravity'); }`
    - Add a button in HTML: `<button (click)="updateName()">Change Name</button>`
    - Click it and watch the name update instantly!

3.  **Computed Signals**:
    - Import `computed`.
    - Add: `label = computed(() => 'User: ' + this.username());`
    - Display `{{ label() }}` in HTML. It will auto-update when `username` changes.

## Chapter 4: Control Flow (@if, @for)

**Goal**: Render lists and conditional content efficiently.

1.  **@if Block**:
    - Add a signal: `isAdmin = signal(false);`
    - In HTML:
      ```html
      @if (isAdmin()) {
      <p>Welcome, Admin!</p>
      } @else {
      <p>Welcome, User.</p>
      }
      <button (click)="isAdmin.set(!isAdmin())">Toggle Admin</button>
      ```

2.  **@for Loop**:
    - Add a signal: `skills = signal(['Angular', 'TypeScript', 'Signals']);`
    - In HTML:
      ```html
      <ul>
        @for (skill of skills(); track skill) {
        <li>{{ skill }}</li>
        }
      </ul>
      ```
    - Note: `track` is required for performance!

## Chapter 5: Services & Dependency Injection

**Goal**: Share logic across components using Services.

1.  **Create a Service**:
    // turbo
    - `ng generate service services/logging` (in `frontend` directory)

2.  **Implement Logic**:
    - Open `src/app/services/logging.service.ts`.
    - Add a method: `log(message: string) { console.log('LOG:', message); }`

3.  **Inject and Use**:
    - In `user-profile.component.ts`:
    - Import `inject` from `@angular/core` and your service.
    - Add property: `logger = inject(LoggingService);`
    - Update `greet()`: `this.logger.log('User clicked greet');`

4.  **Verify**:
    - Click the "Say Hi" button and check the browser console.

---

**Next Steps**:

- Try creating a "Task List" app using these concepts!
- Explore Routing to create multi-page apps.
