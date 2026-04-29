const screens = [...document.querySelectorAll(".app-screen")];
const navButtons = [...document.querySelectorAll(".bottom-nav button")];
const nav = document.querySelector(".bottom-nav");
const fab = document.querySelector(".fab");
const shell = document.querySelector(".phone-shell");

function showScreen(name) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === name);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.go === name);
  });

  const primaryScreens = ["home", "qr"];
  const publicView = name === "public-menu";
  nav.style.display = primaryScreens.includes(name) && !publicView ? "grid" : "none";
  fab.style.display = primaryScreens.includes(name) && !publicView ? "block" : "none";
  shell.classList.toggle("nav-hidden", !primaryScreens.includes(name) || publicView);

  if (location.hash.slice(1) !== name) {
    history.replaceState(null, "", `#${name}`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-go]");
  if (!trigger) return;
  showScreen(trigger.dataset.go);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const trigger = event.target.closest("[data-go]");
  if (!trigger) return;
  event.preventDefault();
  showScreen(trigger.dataset.go);
});

document.querySelectorAll(".language-row button, .category-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    const siblings = [...button.parentElement.children];
    siblings.forEach((item) => item.classList.toggle("is-selected", item === button));
  });
});

const initialScreen = location.hash.slice(1);
if (screens.some((screen) => screen.dataset.screen === initialScreen)) {
  showScreen(initialScreen);
}
