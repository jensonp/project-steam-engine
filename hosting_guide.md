# Hosting Your Steam Engine for Free (Student Guide)

As a student, you can host your full-stack application entirely for free using these industry-standard platforms. Since your project has a **Frontend (Angular)** and a **Backend (Node.js)**, the best approach is to split them up.

---

## 1. Frontend: Vercel (Fast & Free)
Vercel is the gold standard for hosting Angular apps. It's free, has a global CDN, and connects directly to your GitHub.

### Steps:
1. **GitHub Push**: Ensure your latest code is pushed to a GitHub repository.
2. **Sign Up**: Go to [vercel.com](https://vercel.com) and sign up using your GitHub account.
3. **Import Project**: 
   - Click **"Add New"** > **"Project"**.
   - Select your `project-steam-engine` repository.
4. **Configure**:
   - Vercel should automatically detect **Angular**.
   - **Root Directory**: Set this to `frontend` if your project is a monorepo.
   - **Environment Variables**: Add a variable named `BACKEND_URL` and point it to your Railway URL (see below).
5. **Deploy**: Click **Deploy**. You'll get a URL like `project-steam-engine.vercel.app`.

---

## 2. Backend: Railway (Scalable & Student-Friendly)
Railway is excellent for Node.js backends. They offer a "Trial" plan which is perfect for students.

### Steps:
1. **Sign Up**: Go to [railway.app](https://railway.app) and sign up with GitHub.
2. **New Project**:
   - Click **"New Project"** > **"Deploy from GitHub repo"**.
   - Select your repository.
3. **Configure Service**:
   - Railway will detect your `backend` folder (if you tell it the root is `backend`).
   - **Variables**: Under the "Variables" tab, add your `STEAM_API_KEY` and any other secrets from your `.env` file.
4. **Networking**: 
   - Ensure your backend listens on `process.env.PORT`.
   - Railway will provide a public URL (e.g., `backend-production.up.railway.app`).
5. **CORS**: Make sure your backend allows requests from your Vercel URL!

---

## 3. Connecting the Two
Once both are live, you need to "link" them:

1. Copy your **Railway URL**.
2. Go to your **Vercel Project Settings** > **Environment Variables**.
3. Update `BACKEND_URL` to your Railway URL.
4. Redeploy the frontend.

---

> [!TIP]
> **GitHub Student Developer Pack**: Since you are a student, sign up for the [GitHub Student Pack](https://education.github.com/pack). It gives you **free credits** for DigitalOcean, Heroku, and many other hosting providers that usually cost money!

> [!IMPORTANT]
> Never commit your `.env` file to GitHub. Always add your API keys manually in the Vercel/Railway dashboard settings.

# Final Update: Tue Mar 17 18:41:18 PDT 2026
