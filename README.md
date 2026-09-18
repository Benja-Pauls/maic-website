# MAIC Website

This is the source code for the MSOE AI Club (MAIC) website. It is a modern React application built with [Vite](https://vitejs.dev/) and TypeScript.

This documentation is designed to help developers of all experience levels set up, run, and maintain the website.

## 🚀 Quick Start

### Live points and membership

The home and Points page standings read the ALL chapter roster through the public
`/api/leaderboard?chapter=msoe-ai-club` endpoint. All-time points determine rank;
current points are the balance available to spend. Both views refresh every minute
while visible and when the visitor returns to the tab. The home page searches the
complete roster, including chapters with more than 500 members.

Point changes and event check-ins should be made in the ALL chapter dashboard.
`maic-content/data/points/user_data.csv` is no longer a source for these standings.
An API failure displays a retry notice instead of silently substituting old CSV
numbers. Run the integration regression checks with
`node --test scripts/test-live-leaderboard.cjs`.

### Prerequisites

Before you begin, ensure you have the following installed on your computer:

1.  **Node.js**: A JavaScript runtime. We recommend the latest LTS version (v20+).  
    [Download Node.js](https://nodejs.org/)
2.  **Git**: Version control system to manage the code.  
    [Download Git](https://git-scm.com/)
3.  **Code Editor**: We recommend [Visual Studio Code](https://code.visualstudio.com/) (VS Code).

### Installation

1.  **Clone the repository**:
    Open your terminal (Command Prompt, PowerShell, or Git Bash) and run:

    ```bash
    git clone https://github.com/MSOE-AI-Club/maic-website.git
    cd maic-website
    ```

2.  **Install dependencies**:
    This downloads all the necessary libraries specified in `package.json`.

    ```bash
    npm install
    ```

    _(Note: If you use `bun`, you can run `bun install` instead.)_

3.  **Setup Environment Variables**:
    The application relies on environment variables for configuration (like API content URLs).
    1.  Copy the example environment file:
        - **Windows**: Copy `.example.env` and rename it to `.env`.
        - **Mac/Linux**: `cp .example.env .env`
    2.  Open `.env` in your text editor. It should look like this:
        ```bash
        VITE_CONTENT_BASE_URL=/content
        VITE_PUBLIC_POSTHOG_KEY=
        VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
        VITE_CLERK_PUBLISHABLE_KEY=
        ```

        > **Note**: Older versions of the project used a `VITE_BRANCH` environment variable. This is now legacy/unused and does not need to be set in new `.env` files.
    3.  **Important**: You will need to obtain the `VITE_PUBLIC_POSTHOG_KEY` (for analytics) from a team lead or the project administrator.

        > **Note**: Clerk authentication (`VITE_CLERK_PUBLISHABLE_KEY`) is currently disabled in the codebase. You can leave this blank unless authentication is re-enabled.

### Running the Application

#### `npm run dev` — Day-to-day development

```bash
npm run dev
```

Use this whenever you are **writing or editing code**. Vite compiles on-the-fly and the browser reloads automatically every time you save a file. The terminal will show a URL (usually `http://localhost:5173/`).

- No build step needed — just run and start coding.
- Proxies `/content` to `http://localhost:8000` if `VITE_CONTENT_BASE_URL=/content` is set in `.env`.

#### `npm run build` — Compile for production

```bash
npm run build
```

Use this when you are **done with your changes and want to produce a deployable bundle**. It compiles and optimizes everything into the `dist/` folder. You do not browse the site directly from this command — use `npm run preview` after.

- Run this before `npm run preview`.
- This is also what the CI/CD pipeline runs when deploying to GitHub Pages.

#### `npm run preview` — Test the production build locally

```bash
npm run build && npm run preview
```

Use this when you want to **verify your changes behave correctly in a production-like environment** before pushing. It serves the already-built `dist/` folder — it does not recompile on save.

- Always run `npm run build` first, otherwise you are previewing a stale build.
- Like `npm run dev`, it proxies `/content` to `http://localhost:8000` when `VITE_CONTENT_BASE_URL=/content` is set.
- If you just want to quickly check against the live CDN, comment out `VITE_CONTENT_BASE_URL` in `.env` before building (no local content server needed).

#### Quick reference

| Command           | When to use                                        | Auto-reloads on save? | Needs `npm run build` first? |
| ----------------- | -------------------------------------------------- | --------------------- | ---------------------------- |
| `npm run dev`     | Writing / editing code                             | Yes                   | No                           |
| `npm run build`   | Preparing a deployable bundle                      | —                     | —                            |
| `npm run preview` | Verifying the final build before pushing           | No                    | Yes                          |
| `npm run lint`    | Checking for code style / type errors              | No                    | No                           |

---

## 🛠 Project Structure

Here is a high-level overview of the most important files and folders:

```
maic-website/
├── public/              # Static assets served directly (e.g., icons)
├── src/                 # Main source code
│   ├── assets/          # Images and other static files imported in code
│   ├── components/      # Reusable UI components organized by page/feature
│   │   ├── home-page/   # Components specific to the Home page
│   │   ├── library/     # Components for the Library feature
│   │   ├── navbar/      # Navigation bar components
│   │   └── ...          # Other page-specific component folders
│   ├── hooks/           # Custom React hooks (logic reuse)
│   │   ├── github-hook.ts    # Logic for fetching dynamic content (see below)
│   │   ├── library-helper.ts # Helper functions for the Library feature
│   │   └── alias-redirect.ts # URL alias handling
│   ├── pages/           # Components that represent full pages
│   ├── App.tsx          # Main application component & routing setup
│   ├── main.tsx         # Entry point of the React application
│   └── index.css        # Global styles and Tailwind imports
├── .env                 # Environment variables (do not commit this file!)
├── .example.env         # Template for environment variables
├── eslint.config.js     # ESLint configuration
├── package.json         # Project metadata, scripts, and dependencies
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite build tool configuration
```

### Pages Overview

The website includes the following pages (defined in `src/App.tsx`):

| Route            | Page          | Description                             |
| ---------------- | ------------- | --------------------------------------- |
| `/`              | Home          | Main landing page                       |
| `/about`         | About         | Information about MAIC                  |
| `/events`        | Events        | Upcoming and past events                |
| `/library`       | Library       | Educational content and articles        |
| `/learning-tree` | Learning Tree | Interactive learning path visualization |
| `/achievements`  | Achievements  | Member achievements and badges          |
| `/points`        | Points        | Points/gamification system              |
| `/contact`       | Contact       | Contact information                     |
| `/merch`         | Merch         | Club merchandise                        |

## 🧩 Key Concepts & Architecture

### The Content Hook (`github-hook.ts`)

A unique feature of this website is that it **fetches its content dynamically** from a separate repository (`maic-content`). This allows non-developers to update website text/images without touching the website code.

- **How it works**:
  The `github-hook.ts` file contains logic to fetch a `manifest.json` file from a remote URL (the Content CDN). This manifest lists all available markdown files and images. The website then uses this list to display articles, tutorials, or other content.

- **Configuration**:
  The hook resolves the content URL in this order:
  1.  `VITE_CONTENT_BASE_URL` from your `.env` file (if set).
  2.  Default CDN: `https://msoe-ai-club.github.io/maic-content/`
  3.  Fallback: `/maic-content` (useful when content repository is a sibling folder).

  **Pointing to the production CDN (recommended for most development)**:
  Comment out or remove `VITE_CONTENT_BASE_URL` in your `.env` file:
  ```bash
  # VITE_CONTENT_BASE_URL=/content
  ```
  The hook will automatically fetch from `https://msoe-ai-club.github.io/maic-content/`. This works for both `npm run dev` and `npm run preview` with no extra setup.

  **Pointing to a local `maic-content` folder**:
  Keep `VITE_CONTENT_BASE_URL=/content` in `.env` and start a local content server on port 8000 from inside the `maic-content` directory:
  ```bash
  cd ../maic-content
  python -m http.server 8000
  ```
  The proxy in `vite.config.ts` forwards all `/content` requests to `http://localhost:8000` for both `npm run dev` and `npm run preview`, so content edits are reflected immediately without deploying to GitHub Pages.

### Styling

We use **Tailwind CSS v4** for styling via the `@tailwindcss/vite` plugin. Instead of writing traditional CSS files, we use utility classes directly in the JSX code (e.g., `className="text-center text-blue-500"`). Global styles are defined in `src/index.css`.

- Docs: [Tailwind CSS Documentation](https://tailwindcss.com/)

### Routing

We use **React Router** to handle navigation. New pages are defined in `src/App.tsx` (or wherever the Router is defined) and the page components live in `src/pages/`.

## 📦 Building for Production

When you are ready to deploy the website, you need to build a production version. This creates a highly optimized `dist/` folder.

```bash
npm run build
```

To test the production build locally before deploying:

```bash
npm run preview
```

> **Note**: `npm run preview` respects `VITE_CONTENT_BASE_URL` the same way `npm run dev` does. If it is set to `/content`, you need a local content server running on port 8000 (see the Content Hook section above). To test against the live CDN instead, comment the variable out in `.env` before building.

## 📚 Resources for New Developers

If you are new to React or Web Development, these resources will be helpful:

- **React**: [Official React Documentation](https://react.dev/learn) (Start here!)
- **TypeScript**: [TypeScript for React Developers](https://www.typescriptlang.org/docs/handbook/react.html)
- **Vite**: [Vite Guide](https://vitejs.dev/guide/)

## 🤝 Development Process

1.  **Develop Locally**: Create a feature branch and develop your changes locally.
2.  **Merge to Dev**: Merge your feature branch into the `dev` branch.
3.  **Test Staging**: Test your changes on [dev.msoe-maic.com](https://dev.msoe-maic.com).
4.  **Merge to Main**: Once verified, merge `dev` into `main` to deploy to production.
