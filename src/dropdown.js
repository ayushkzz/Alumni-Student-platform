// Toggle Dropdown Menu
function toggleDropdown() {
    const dropdown = document.getElementById("dropdownMenu");
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
}

// Edit Profile function
function editProfile() {
    window.location.href = '/edit-profile';
}

// Logout function
function logout() {
    window.location.href = '/logout';
}

// Close dropdown if clicked outside
document.addEventListener('click', function(event) {
    const isClickInside = document.querySelector('.user-icon').contains(event.target);
    if (!isClickInside) {
        const dropdown = document.getElementById("dropdownMenu");
        if (dropdown) {
            dropdown.style.display = "none";
        }
    }
});
