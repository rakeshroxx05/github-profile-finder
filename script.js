const API_BASE = "https://api.github.com/users";
const HISTORY_KEY = "gh-profile-history";

const elements = {
	form: document.getElementById("searchForm"),
	input: document.getElementById("searchInput"),
	status: document.getElementById("status"),
	loader: document.getElementById("loader"),
	profile: document.getElementById("profile"),
	reposSection: document.getElementById("reposSection"),
	history: document.getElementById("history"),
	themeToggle: document.getElementById("themeToggle"),
	avatar: document.getElementById("avatar"),
	name: document.getElementById("name"),
	username: document.getElementById("username"),
	bio: document.getElementById("bio"),
	followers: document.getElementById("followers"),
	following: document.getElementById("following"),
	repos: document.getElementById("repos"),
	location: document.getElementById("location"),
	blog: document.getElementById("blog"),
	created: document.getElementById("created"),
	profileLink: document.getElementById("profileLink"),
	repoList: document.getElementById("repoList"),
	totalStars: document.getElementById("totalStars"),
};

let lastSearch = "";
let isLoading = false;

const debounce = (fn, delay = 700) => {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
};

const formatDate = (isoString) => {
	const date = new Date(isoString);
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

const showLoader = (show) => {
	isLoading = show;
	elements.loader.classList.toggle("show", show);
	elements.profile.classList.toggle("is-loading", show);
	elements.reposSection.classList.toggle("is-loading", show);
};

const showError = (message) => {
	elements.status.textContent = message;
};

const clearError = () => {
	elements.status.textContent = "";
};

const fetchUser = async (username) => {
	const response = await fetch(`${API_BASE}/${username}`);
	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		return { error: true, status: response.status, message: data.message || "" };
	}
	return response.json();
};

const fetchRepos = async (username) => {
	const response = await fetch(`${API_BASE}/${username}/repos?sort=updated&per_page=5`);
	if (!response.ok) {
		return [];
	}
	return response.json();
};

const displayUser = (user) => {
	elements.avatar.innerHTML = `<img src="${user.avatar_url}" alt="${user.login}" />`;
	elements.name.textContent = user.name || "No name provided";
	elements.username.textContent = `@${user.login}`;
	elements.bio.textContent = user.bio || "No bio provided.";
	elements.followers.textContent = user.followers;
	elements.following.textContent = user.following;
	elements.repos.textContent = user.public_repos;
	elements.location.textContent = user.location || "Not available";
	if (user.blog) {
		const normalized = user.blog.startsWith("http") ? user.blog : `https://${user.blog}`;
		elements.blog.textContent = normalized;
		elements.blog.href = normalized;
	} else {
		elements.blog.textContent = "Not available";
		elements.blog.removeAttribute("href");
	}
	elements.created.textContent = formatDate(user.created_at);
	elements.profileLink.href = user.html_url;
};

const displayRepos = (repos) => {
	if (!repos.length) {
		elements.repoList.innerHTML = "<p>No repositories to show.</p>";
		elements.totalStars.textContent = "0";
		return;
	}

	let stars = 0;
	elements.repoList.innerHTML = repos
		.map((repo) => {
			stars += repo.stargazers_count || 0;
			const description = repo.description ? repo.description : "No description provided.";
			return `
				<article class="repo">
					<a href="${repo.html_url}" target="_blank" rel="noreferrer">${repo.name}</a>
					<p>${description}</p>
					<div class="repo__meta">
						<span>Stars: ${repo.stargazers_count}</span>
						<span>Forks: ${repo.forks_count}</span>
						<span>Lang: ${repo.language || "-"}</span>
					</div>
				</article>
			`;
		})
		.join("");

	elements.totalStars.textContent = stars.toString();
};

const loadHistory = () => {
	try {
		const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
		return Array.isArray(stored) ? stored : [];
	} catch (error) {
		return [];
	}
};

const saveHistory = (username) => {
	const history = loadHistory();
	const normalized = username.toLowerCase();
	const updated = [normalized, ...history.filter((item) => item !== normalized)].slice(0, 6);
	localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
	renderHistory(updated);
};

const renderHistory = (items) => {
	if (!items.length) {
		elements.history.innerHTML = "";
		return;
	}
	elements.history.innerHTML = items
		.map((item) => `<button type="button" data-user="${item}">${item}</button>`)
		.join("");
};

const handleSearch = async ({ auto } = {}) => {
	const username = elements.input.value.trim();

	if (!username) {
		showError("Please enter a GitHub username.");
		return;
	}

	if (auto && (username.length < 3 || username === lastSearch || isLoading)) {
		return;
	}

	clearError();
	showLoader(true);
	lastSearch = username;

	const user = await fetchUser(username);
	if (user.error) {
		showLoader(false);
		if (user.status === 404) {
			showError("User not found. Please check the username.");
			return;
		}
		if (user.status === 403 && user.message.toLowerCase().includes("rate limit")) {
			showError("API rate limit exceeded. Try again later.");
			return;
		}
		showError("Something went wrong. Please try again.");
		return;
	}

	const repos = await fetchRepos(username);
	displayUser(user);
	displayRepos(repos);
	saveHistory(username);
	showLoader(false);
};

const initTheme = () => {
	const stored = localStorage.getItem("gh-theme");
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const theme = stored || (prefersDark ? "dark" : "light");
	document.documentElement.setAttribute("data-theme", theme);
	elements.themeToggle.setAttribute("aria-pressed", theme === "dark");
	elements.themeToggle.querySelector(".toggle__text").textContent =
		theme === "dark" ? "Dark" : "Light";
};

const toggleTheme = () => {
	const current = document.documentElement.getAttribute("data-theme");
	const next = current === "dark" ? "light" : "dark";
	document.documentElement.setAttribute("data-theme", next);
	localStorage.setItem("gh-theme", next);
	elements.themeToggle.setAttribute("aria-pressed", next === "dark");
	elements.themeToggle.querySelector(".toggle__text").textContent =
		next === "dark" ? "Dark" : "Light";
};

const debouncedAutoSearch = debounce(() => handleSearch({ auto: true }));

elements.form.addEventListener("submit", (event) => {
	event.preventDefault();
	handleSearch();
});

elements.input.addEventListener("input", () => {
	clearError();
	debouncedAutoSearch();
});

elements.history.addEventListener("click", (event) => {
	const button = event.target.closest("button[data-user]");
	if (!button) return;
	elements.input.value = button.dataset.user;
	handleSearch();
});

elements.themeToggle.addEventListener("click", toggleTheme);

initTheme();
renderHistory(loadHistory());
