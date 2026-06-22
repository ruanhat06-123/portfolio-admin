// ==============================
// SUPABASE SETTINGS
// ==============================
// Use your public anon/publishable key.
// NEVER use your service_role key in frontend JavaScript.

const SUPABASE_URL = "https://dvjosisqpvopbxcglwhl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0LJnUqBnCZohvWoIFn5NWA_B3UtoKFv";

let supabaseClient = null;

if (typeof supabase !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("Admin Supabase client created.");
} else {
  console.error("Supabase library was not loaded.");
}

// ==============================
// PAGE LOAD
// ==============================
document.addEventListener("DOMContentLoaded", async () => {
  const adminStatus = document.getElementById("admin-status");

  if (!supabaseClient) {
    if (adminStatus) {
      adminStatus.textContent =
        "Supabase is not connected. Check your Supabase URL, key, and script tag.";
    }
    return;
  }

  setupEventListeners();
  await checkCurrentSession();
});

// ==============================
// PAGE HELPERS
// ==============================
function isProjectsPage() {
  return !!document.getElementById("project-form");
}

function isTestimonialsPage() {
  return !!document.getElementById("testimonial-form");
}

// ==============================
// EVENT LISTENERS
// ==============================
function setupEventListeners() {
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");

  const projectForm = document.getElementById("project-form");
  const cancelProjectEditButton = document.getElementById("cancel-edit-button");

  const testimonialForm = document.getElementById("testimonial-form");
  const cancelTestimonialEditButton = document.getElementById(
    "cancel-testimonial-edit-button"
  );

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      await loginAdmin();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      showLogin("You have been logged out.");
    });
  }

  if (projectForm) {
    projectForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveProject();
    });
  }

  if (cancelProjectEditButton) {
    cancelProjectEditButton.addEventListener("click", async () => {
      await resetProjectForm();
    });
  }

  if (testimonialForm) {
    testimonialForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveTestimonial();
    });
  }

  if (cancelTestimonialEditButton) {
    cancelTestimonialEditButton.addEventListener("click", async () => {
      await resetTestimonialForm();
    });
  }
}

// ==============================
// CHECK CURRENT SESSION
// ==============================
async function checkCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    showLogin("Could not check login session.");
    return;
  }

  if (!session) {
    showLogin();
    return;
  }

  const isAdmin = await verifyAdminUser();

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    showLogin("This account is not allowed to access the admin dashboard.");
    return;
  }

  await showDashboard();
}

// ==============================
// LOGIN ADMIN
// ==============================
async function loginAdmin() {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  const adminStatus = document.getElementById("admin-status");

  if (adminStatus) {
    adminStatus.textContent = "Logging in...";
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login error:", error);

    if (adminStatus) {
      adminStatus.textContent = "Login failed. Please check your email and password.";
    }

    return;
  }

  const isAdmin = await verifyAdminUser();

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    showLogin("This account is not listed as an admin.");
    return;
  }

  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.reset();
  }

  await showDashboard();
}

// ==============================
// VERIFY ADMIN USER
// ==============================
async function verifyAdminUser() {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    console.error("User check error:", userError);
    return false;
  }

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin verification error:", error);
    return false;
  }

  return !!data;
}

// ==============================
// SHOW LOGIN
// ==============================
function showLogin(message = "Please log in to manage your content.") {
  const loginSection = document.getElementById("login-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const adminStatus = document.getElementById("admin-status");

  if (loginSection) {
    loginSection.style.display = "block";
  }

  if (dashboardSection) {
    dashboardSection.style.display = "none";
  }

  if (adminStatus) {
    adminStatus.textContent = message;
  }
}

// ==============================
// SHOW DASHBOARD
// ==============================
async function showDashboard() {
  const loginSection = document.getElementById("login-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const adminStatus = document.getElementById("admin-status");

  if (loginSection) {
    loginSection.style.display = "none";
  }

  if (dashboardSection) {
    dashboardSection.style.display = "block";
  }

  if (adminStatus) {
    adminStatus.textContent = "You are logged in.";
  }

  if (isProjectsPage()) {
    await loadProjects();
    await setNextProjectDisplayOrder();
  }

  if (isTestimonialsPage()) {
    await loadTestimonials();
    await setNextTestimonialDisplayOrder();
  }
}

// =====================================================
// PROJECTS
// =====================================================

// ==============================
// GET NEXT PROJECT DISPLAY ORDER
// ==============================
async function getNextProjectDisplayOrder() {
  const { data, error } = await supabaseClient
    .from("projects")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Could not get next project display order:", error);
    return 1;
  }

  if (!data || data.length === 0) {
    return 1;
  }

  const highestDisplayOrder = Number(data[0].display_order) || 0;
  return highestDisplayOrder + 1;
}

// ==============================
// SET NEXT PROJECT DISPLAY ORDER
// ==============================
async function setNextProjectDisplayOrder() {
  const displayOrderInput = document.getElementById("project-display-order");
  const projectIdInput = document.getElementById("project-id");

  if (!displayOrderInput) return;

  if (projectIdInput && projectIdInput.value) return;

  const nextDisplayOrder = await getNextProjectDisplayOrder();
  displayOrderInput.value = nextDisplayOrder;
}

// ==============================
// SAVE PROJECT
// ==============================
async function saveProject() {
  const adminStatus = document.getElementById("admin-status");

  const projectId = document.getElementById("project-id").value;
  const title = document.getElementById("project-title").value.trim();
  const description = document.getElementById("project-description").value.trim();
  const technologiesInput = document.getElementById("project-technologies").value.trim();
  const liveUrl = document.getElementById("project-live-url").value.trim();
  const sourceUrl = document.getElementById("project-source-url").value.trim();
  const displayOrder = Number(document.getElementById("project-display-order").value);
  const isFeatured = document.getElementById("project-featured").checked;
  const isPublished = document.getElementById("project-published").checked;

  if (!title || !description || !technologiesInput) {
    if (adminStatus) {
      adminStatus.textContent = "Please complete all required project fields.";
    }
    return;
  }

  const technologies = technologiesInput
    .split(",")
    .map(technology => technology.trim())
    .filter(Boolean);

  const links = [];

  if (liveUrl) {
    links.push({
      label: "View Website",
      url: liveUrl,
    });
  }

  if (sourceUrl) {
    links.push({
      label: "View Source Code",
      url: sourceUrl,
    });
  }

  const projectData = {
    title,
    description,
    technologies,
    links,
    display_order: displayOrder,
    is_featured: isFeatured,
    is_published: isPublished,
  };

  if (adminStatus) {
    adminStatus.textContent = "Saving project...";
  }

  let result;

  if (projectId) {
    result = await supabaseClient
      .from("projects")
      .update(projectData)
      .eq("id", projectId);
  } else {
    result = await supabaseClient
      .from("projects")
      .insert(projectData);
  }

  if (result.error) {
    console.error("Save project error:", result.error);

    if (adminStatus) {
      adminStatus.textContent =
        "Failed to save project. Check your Supabase RLS policies.";
    }

    return;
  }

  if (adminStatus) {
    adminStatus.textContent = projectId
      ? "Project updated successfully."
      : "Project added successfully.";
  }

  await loadProjects();
  await resetProjectForm();
}

// ==============================
// LOAD PROJECTS
// ==============================
async function loadProjects() {
  const projectsList = document.getElementById("projects-list");
  const adminStatus = document.getElementById("admin-status");

  if (!projectsList) return;

  projectsList.innerHTML = "<p>Loading projects...</p>";

  const { data: projects, error } = await supabaseClient
    .from("projects")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Load projects error:", error);
    projectsList.innerHTML = "<p>Failed to load projects.</p>";

    if (adminStatus) {
      adminStatus.textContent =
        "Could not load projects. Make sure your account exists in admin_users.";
    }

    return;
  }

  if (!projects || projects.length === 0) {
    projectsList.innerHTML = "<p>No projects added yet.</p>";
    return;
  }

  projectsList.innerHTML = "";

  projects.forEach(project => {
    const projectItem = document.createElement("article");
    projectItem.classList.add("admin-list-item");

    const title = document.createElement("h3");
    title.textContent = project.title;

    const description = document.createElement("p");
    description.textContent = project.description;

    const technologies = document.createElement("p");
    technologies.classList.add("admin-meta-soft");

    if (Array.isArray(project.technologies)) {
      technologies.textContent = `Technologies: ${project.technologies.join(", ")}`;
    } else {
      technologies.textContent = "Technologies: None listed";
    }

    const meta = document.createElement("p");
    meta.classList.add("admin-meta");
    meta.textContent = `Order: ${project.display_order} | Published: ${
      project.is_published ? "Yes" : "No"
    } | Featured: ${project.is_featured ? "Yes" : "No"}`;

    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("admin-button-group");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      fillProjectForm(project);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.classList.add("danger-button");
    deleteButton.addEventListener("click", async () => {
      await deleteProject(project.id);
    });

    buttonGroup.appendChild(editButton);
    buttonGroup.appendChild(deleteButton);

    projectItem.appendChild(title);
    projectItem.appendChild(description);
    projectItem.appendChild(technologies);
    projectItem.appendChild(meta);
    projectItem.appendChild(buttonGroup);

    projectsList.appendChild(projectItem);
  });
}

// ==============================
// FILL PROJECT FORM
// ==============================
function fillProjectForm(project) {
  document.getElementById("project-form-title").textContent = "Edit Project";
  document.getElementById("project-id").value = project.id;
  document.getElementById("project-title").value = project.title || "";
  document.getElementById("project-description").value = project.description || "";

  document.getElementById("project-technologies").value =
    Array.isArray(project.technologies)
      ? project.technologies.join(", ")
      : "";

  const links = Array.isArray(project.links) ? project.links : [];

  const liveLink = links.find(link => link.label === "View Website");
  const sourceLink = links.find(link => link.label === "View Source Code");

  document.getElementById("project-live-url").value = liveLink ? liveLink.url : "";
  document.getElementById("project-source-url").value = sourceLink ? sourceLink.url : "";

  document.getElementById("project-display-order").value =
    project.display_order || 1;

  document.getElementById("project-featured").checked = !!project.is_featured;
  document.getElementById("project-published").checked = !!project.is_published;

  document.getElementById("cancel-edit-button").style.display = "block";

  const title = document.getElementById("project-form-title");

  if (title) {
    title.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

// ==============================
// RESET PROJECT FORM
// ==============================
async function resetProjectForm() {
  const projectForm = document.getElementById("project-form");

  if (!projectForm) return;

  document.getElementById("project-form-title").textContent = "Add New Project";
  document.getElementById("project-id").value = "";
  document.getElementById("cancel-edit-button").style.display = "none";

  projectForm.reset();

  document.getElementById("project-published").checked = true;

  await setNextProjectDisplayOrder();
}

// ==============================
// DELETE PROJECT
// ==============================
async function deleteProject(projectId) {
  const adminStatus = document.getElementById("admin-status");

  const confirmed = confirm("Are you sure you want to delete this project?");

  if (!confirmed) return;

  if (adminStatus) {
    adminStatus.textContent = "Deleting project...";
  }

  const { error } = await supabaseClient
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("Delete project error:", error);

    if (adminStatus) {
      adminStatus.textContent = "Failed to delete project.";
    }

    return;
  }

  if (adminStatus) {
    adminStatus.textContent = "Project deleted successfully.";
  }

  await loadProjects();
  await resetProjectForm();
}

// =====================================================
// TESTIMONIALS
// =====================================================

// ==============================
// GET NEXT TESTIMONIAL DISPLAY ORDER
// ==============================
async function getNextTestimonialDisplayOrder() {
  const { data, error } = await supabaseClient
    .from("testimonials")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Could not get next testimonial display order:", error);
    return 1;
  }

  if (!data || data.length === 0) {
    return 1;
  }

  const highestDisplayOrder = Number(data[0].display_order) || 0;
  return highestDisplayOrder + 1;
}

// ==============================
// SET NEXT TESTIMONIAL DISPLAY ORDER
// ==============================
async function setNextTestimonialDisplayOrder() {
  const displayOrderInput = document.getElementById("testimonial-display-order");
  const testimonialIdInput = document.getElementById("testimonial-id");

  if (!displayOrderInput) return;

  if (testimonialIdInput && testimonialIdInput.value) return;

  const nextDisplayOrder = await getNextTestimonialDisplayOrder();
  displayOrderInput.value = nextDisplayOrder;
}

// ==============================
// SAVE TESTIMONIAL
// ==============================
async function saveTestimonial() {
  const adminStatus = document.getElementById("admin-status");

  const testimonialId = document.getElementById("testimonial-id").value;
  const authorName = document.getElementById("testimonial-author-name").value.trim();
  const authorRole = document.getElementById("testimonial-author-role").value.trim();
  const quote = document.getElementById("testimonial-quote").value.trim();
  const displayOrder = Number(
    document.getElementById("testimonial-display-order").value
  );
  const isPublished = document.getElementById("testimonial-published").checked;

  if (!authorName || !quote) {
    if (adminStatus) {
      adminStatus.textContent =
        "Please complete the required testimonial fields.";
    }
    return;
  }

  const testimonialData = {
    author_name: authorName,
    author_role: authorRole,
    quote,
    display_order: displayOrder,
    is_published: isPublished,
  };

  if (adminStatus) {
    adminStatus.textContent = "Saving testimonial...";
  }

  let result;

  if (testimonialId) {
    result = await supabaseClient
      .from("testimonials")
      .update(testimonialData)
      .eq("id", testimonialId);
  } else {
    result = await supabaseClient
      .from("testimonials")
      .insert(testimonialData);
  }

  if (result.error) {
    console.error("Save testimonial error:", result.error);

    if (adminStatus) {
      adminStatus.textContent =
        "Failed to save testimonial. Check your Supabase RLS policies.";
    }

    return;
  }

  if (adminStatus) {
    adminStatus.textContent = testimonialId
      ? "Testimonial updated successfully."
      : "Testimonial added successfully.";
  }

  await loadTestimonials();
  await resetTestimonialForm();
}

// ==============================
// LOAD TESTIMONIALS
// ==============================
async function loadTestimonials() {
  const testimonialsList = document.getElementById("testimonials-list");
  const adminStatus = document.getElementById("admin-status");

  if (!testimonialsList) return;

  testimonialsList.innerHTML = "<p>Loading testimonials...</p>";

  const { data: testimonials, error } = await supabaseClient
    .from("testimonials")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Load testimonials error:", error);
    testimonialsList.innerHTML = "<p>Failed to load testimonials.</p>";

    if (adminStatus) {
      adminStatus.textContent =
        "Could not load testimonials. Make sure your account exists in admin_users.";
    }

    return;
  }

  if (!testimonials || testimonials.length === 0) {
    testimonialsList.innerHTML = "<p>No testimonials added yet.</p>";
    return;
  }

  testimonialsList.innerHTML = "";

  testimonials.forEach(testimonial => {
    const testimonialItem = document.createElement("article");
    testimonialItem.classList.add("admin-list-item");

    const author = document.createElement("h3");
    author.textContent = testimonial.author_name;

    const quote = document.createElement("p");
    quote.textContent = testimonial.quote;

    const role = document.createElement("p");
    role.classList.add("admin-meta-soft");
    role.textContent = `Role: ${testimonial.author_role || "Not specified"}`;

    const meta = document.createElement("p");
    meta.classList.add("admin-meta");
    meta.textContent = `Order: ${testimonial.display_order} | Published: ${
      testimonial.is_published ? "Yes" : "No"
    }`;

    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("admin-button-group");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      fillTestimonialForm(testimonial);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.classList.add("danger-button");
    deleteButton.addEventListener("click", async () => {
      await deleteTestimonial(testimonial.id);
    });

    buttonGroup.appendChild(editButton);
    buttonGroup.appendChild(deleteButton);

    testimonialItem.appendChild(author);
    testimonialItem.appendChild(quote);
    testimonialItem.appendChild(role);
    testimonialItem.appendChild(meta);
    testimonialItem.appendChild(buttonGroup);

    testimonialsList.appendChild(testimonialItem);
  });
}

// ==============================
// FILL TESTIMONIAL FORM
// ==============================
function fillTestimonialForm(testimonial) {
  document.getElementById("testimonial-form-title").textContent =
    "Edit Testimonial";

  document.getElementById("testimonial-id").value = testimonial.id;
  document.getElementById("testimonial-author-name").value =
    testimonial.author_name || "";
  document.getElementById("testimonial-author-role").value =
    testimonial.author_role || "";
  document.getElementById("testimonial-quote").value = testimonial.quote || "";
  document.getElementById("testimonial-display-order").value =
    testimonial.display_order || 1;
  document.getElementById("testimonial-published").checked =
    !!testimonial.is_published;

  document.getElementById("cancel-testimonial-edit-button").style.display =
    "block";

  const title = document.getElementById("testimonial-form-title");

  if (title) {
    title.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

// ==============================
// RESET TESTIMONIAL FORM
// ==============================
async function resetTestimonialForm() {
  const testimonialForm = document.getElementById("testimonial-form");

  if (!testimonialForm) return;

  document.getElementById("testimonial-form-title").textContent =
    "Add New Testimonial";

  document.getElementById("testimonial-id").value = "";
  document.getElementById("cancel-testimonial-edit-button").style.display =
    "none";

  testimonialForm.reset();

  document.getElementById("testimonial-published").checked = true;

  await setNextTestimonialDisplayOrder();
}

// ==============================
// DELETE TESTIMONIAL
// ==============================
async function deleteTestimonial(testimonialId) {
  const adminStatus = document.getElementById("admin-status");

  const confirmed = confirm("Are you sure you want to delete this testimonial?");

  if (!confirmed) return;

  if (adminStatus) {
    adminStatus.textContent = "Deleting testimonial...";
  }

  const { error } = await supabaseClient
    .from("testimonials")
    .delete()
    .eq("id", testimonialId);

  if (error) {
    console.error("Delete testimonial error:", error);

    if (adminStatus) {
      adminStatus.textContent = "Failed to delete testimonial.";
    }

    return;
  }

  if (adminStatus) {
    adminStatus.textContent = "Testimonial deleted successfully.";
  }

  await loadTestimonials();
  await resetTestimonialForm();
}