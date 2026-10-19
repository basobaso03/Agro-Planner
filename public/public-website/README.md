# Agro Planner Public Website

This is the standalone public marketing and download website for **Agro Planner** by **BASOBASO SOFTWARES**.

It is completely separated from the private syndicate application and mobile app codebase.

## 🚀 How to Host on GitHub Pages:

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository (e.g. `agro-planner-site` or `agro-planner`).
2. Make it **Public**.

### Step 2: Push this folder
In this `public-website` folder or in your repository:
```bash
git init
git add .
git commit -m "Initial release of Agro Planner public marketing website"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<REPO-NAME>.git
git push -u origin main
```

### Step 3: Turn on GitHub Pages
1. Go to your GitHub repository -> **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
3. Under **Branch**, select `main` and folder `/ (root)` and click **Save**.
4. In ~60 seconds, your site is live at:
   `https://<YOUR-USERNAME>.github.io/<REPO-NAME>/`
