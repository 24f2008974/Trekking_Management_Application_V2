const { createApp } = Vue;

createApp({

    data() {
        return {

            // =================================================
            // COMMON APPLICATION STATE
            // =================================================

            currentPage: "login",

            loading: false,

            errorMessage: "",

            successMessage: "",

            token: localStorage.getItem("access_token"),

            currentUser: null,


            // =================================================
            // LOGIN
            // =================================================

            loginForm: {
                email: "",
                password: ""
            },


            // =================================================
            // TREKKER REGISTRATION
            // =================================================

            registerForm: {
                name: "",
                email: "",
                phone: "",
                password: "",
                confirmPassword: ""
            },


            // =================================================
            // ADMIN DASHBOARD
            // =================================================

            adminStats: {
                total_treks: 0,
                total_staff: 0,
                total_trekkers: 0,
                total_bookings: 0,
                open_treks: 0,
                completed_treks: 0
            },


            // =================================================
            // ADMIN TREKS
            // =================================================

            treks: [],

            trekFormMode: "create",

            trekForm: {
                id: null,
                name: "",
                location: "",
                difficulty: "Easy",
                duration: 1,
                total_slots: 1,
                description: "",
                start_date: "",
                end_date: "",
                status: "Pending"
            },


            // =================================================
            // ADMIN STAFF
            // =================================================

            staff: [],

            staffForm: {
                name: "",
                email: "",
                password: "",
                phone: "",
                experience: "",
                specialization: "",
                emergency_contact: "",
                address: ""
            },

            assignForm: {
                trek_id: "",
                staff_id: ""
            },


            // =================================================
            // ADMIN USERS
            // =================================================

            users: [],


            // =================================================
            // ADMIN BOOKINGS
            // =================================================

            bookings: [],


            // =================================================
            // ADMIN SEARCH
            // =================================================

            searchQuery: "",

            searchResults: {
                treks: [],
                users: [],
                staff: []
            },


            // =================================================
            // STAFF DASHBOARD
            // =================================================

            staffStats: {
                assigned_treks: 0,
                open_treks: 0,
                ongoing_treks: 0,
                completed_treks: 0,
                total_participants: 0
            },


            // =================================================
            // STAFF TREKS
            // =================================================

            staffTreks: [],

            selectedStaffTrek: null,

            staffSlotForm: {
                total_slots: 1
            },


            // =================================================
            // STAFF PARTICIPANTS
            // =================================================

            staffParticipants: [],


            // =================================================
            // STAFF PROFILE
            // =================================================

            staffProfile: null,


            // =================================================
            // TREKKER DASHBOARD
            // =================================================

            trekkerStats: {
                available_treks: 0,
                active_bookings: 0,
                completed_treks: 0,
                cancelled_bookings: 0
            },


            // =================================================
            // TREKKER TREKS
            // =================================================

            availableTreks: [],

            selectedTrek: null,

            trekFilters: {
                search: "",
                difficulty: "",
                location: "",
                duration: ""
            },


            // =================================================
            // TREKKER BOOKINGS
            // =================================================

            trekkerBookings: [],

            trekkerHistory: [],


            // =================================================
            // TREKKER PROFILE
            // =================================================

            trekkerProfile: null,

            trekkerProfileForm: {
                name: "",
                phone: ""
            },


            // =================================================
            // CELERY EXPORT JOB
            // =================================================

            exportJob: null,


            // =================================================
            // NOTIFICATIONS
            // =================================================

            notifications: [],

            unreadNotifications: 0
        };
    },


    // =========================================================
    // APPLICATION START
    // =========================================================

    async mounted() {

        if (this.token) {

            await this.loadCurrentUser();

        } else {

            this.currentPage = "login";
        }
    },


    methods: {

        // =====================================================
        // COMMON HELPERS
        // =====================================================

        clearMessages() {

            this.errorMessage = "";

            this.successMessage = "";
        },


        async apiRequest(url, options = {}) {

            const headers = {
                ...(options.headers || {})
            };


            if (this.token) {

                headers["Authorization"] =
                    `Bearer ${this.token}`;
            }


            if (
                options.body &&
                !headers["Content-Type"]
            ) {

                headers["Content-Type"] =
                    "application/json";
            }


            const response = await fetch(
                url,
                {
                    ...options,
                    headers
                }
            );


            let data = {};


            try {

                data = await response.json();

            } catch (error) {

                data = {};
            }


            if (response.status === 401) {

                localStorage.removeItem(
                    "access_token"
                );


                this.token = null;

                this.currentUser = null;

                this.currentPage = "login";


                throw new Error(
                    "Session expired. Please login again."
                );
            }


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    `Request failed (${response.status})`
                );
            }


            return data;
        },


        // =====================================================
        // LOGIN
        // =====================================================

        async login() {

            this.clearMessages();


            if (
                !this.loginForm.email ||
                !this.loginForm.password
            ) {

                this.errorMessage =
                    "Email and password are required.";

                return;
            }


            this.loading = true;


            try {

                const response = await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email:
                                this.loginForm.email,

                            password:
                                this.loginForm.password
                        })
                    }
                );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Login failed."
                    );
                }


                this.token =
                    data.access_token;


                localStorage.setItem(
                    "access_token",
                    this.token
                );


                this.currentUser =
                    data.user;


                await this.redirectByRole();

            } catch (error) {

                this.errorMessage =
                    error.message;

            } finally {

                this.loading = false;
            }
        },


        // =====================================================
        // TREKKER REGISTER
        // =====================================================

        async register() {

            this.clearMessages();


            if (
                !this.registerForm.name ||
                !this.registerForm.email ||
                !this.registerForm.password
            ) {

                this.errorMessage =
                    "Name, email and password are required.";

                return;
            }


            if (
                this.registerForm.password !==
                this.registerForm.confirmPassword
            ) {

                this.errorMessage =
                    "Passwords do not match.";

                return;
            }


            if (
                this.registerForm.password.length < 6
            ) {

                this.errorMessage =
                    "Password must contain at least 6 characters.";

                return;
            }


            this.loading = true;


            try {

                const response = await fetch(
                    "/api/auth/register",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            name:
                                this.registerForm.name,

                            email:
                                this.registerForm.email,

                            phone:
                                this.registerForm.phone,

                            password:
                                this.registerForm.password
                        })
                    }
                );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Registration failed."
                    );
                }


                this.registerForm = {
                    name: "",
                    email: "",
                    phone: "",
                    password: "",
                    confirmPassword: ""
                };


                this.currentPage =
                    "login";


                this.successMessage =
                    "Registration successful. Please login.";

            } catch (error) {

                this.errorMessage =
                    error.message;

            } finally {

                this.loading = false;
            }
        },


        // =====================================================
        // LOAD CURRENT USER
        // =====================================================

        async loadCurrentUser() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/auth/me"
                    );


                this.currentUser =
                    data.user;


                await this.redirectByRole();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // REDIRECT BASED ON ROLE
        // =====================================================

        async redirectByRole() {

            if (!this.currentUser) {

                this.currentPage =
                    "login";

                return;
            }


            if (
                this.currentUser.role ===
                "Admin"
            ) {

                this.currentPage =
                    "admin-dashboard";


                await this.loadAdminDashboard();
            }


            else if (
                this.currentUser.role ===
                "Staff"
            ) {

                this.currentPage =
                    "staff-dashboard";


                await this.loadStaffDashboard();
            }


            else if (
                this.currentUser.role ===
                "Trekker"
            ) {

                this.currentPage =
                    "trekker-dashboard";


                await this.loadTrekkerDashboard();


                await this.loadNotifications();
            }
        },


        // =====================================================
        // LOGOUT
        // =====================================================

        async logout() {

            try {

                if (this.token) {

                    await this.apiRequest(
                        "/api/auth/logout",
                        {
                            method: "POST"
                        }
                    );
                }

            } catch (error) {

                console.log(
                    "Logout API error:",
                    error
                );
            }


            localStorage.removeItem(
                "access_token"
            );


            this.token = null;

            this.currentUser = null;

            this.currentPage =
                "login";


            this.loginForm = {
                email: "",
                password: ""
            };


            this.exportJob = null;

            this.notifications = [];

            this.unreadNotifications = 0;


            this.clearMessages();
        },


        // =====================================================
        // NAVIGATION
        // =====================================================

        async navigate(page) {

            this.clearMessages();

            this.currentPage = page;


            // -------------------------------------------------
            // ADMIN
            // -------------------------------------------------

            if (
                page ===
                "admin-dashboard"
            ) {

                await this.loadAdminDashboard();
            }


            if (
                page ===
                "admin-treks"
            ) {

                await this.loadTreks();
            }


            if (
                page ===
                "admin-staff"
            ) {

                await this.loadStaff();

                await this.loadTreks();
            }


            if (
                page ===
                "admin-users"
            ) {

                await this.loadUsers();
            }


            if (
                page ===
                "admin-bookings"
            ) {

                await this.loadBookings();
            }


            // -------------------------------------------------
            // STAFF
            // -------------------------------------------------

            if (
                page ===
                "staff-dashboard"
            ) {

                await this.loadStaffDashboard();
            }


            if (
                page ===
                "staff-treks"
            ) {

                await this.loadStaffTreks();
            }


            if (
                page ===
                "staff-participants"
            ) {

                this.selectedStaffTrek = null;

                await this.loadStaffParticipants();
            }


            if (
                page ===
                "staff-profile"
            ) {

                await this.loadStaffProfile();
            }


            // -------------------------------------------------
            // TREKKER
            // -------------------------------------------------

            if (
                page ===
                "trekker-dashboard"
            ) {

                await this.loadTrekkerDashboard();
            }


            if (
                page ===
                "trekker-treks"
            ) {

                await this.loadAvailableTreks();
            }


            if (
                page ===
                "trekker-bookings"
            ) {

                await this.loadTrekkerBookings();
            }


            if (
                page ===
                "trekker-history"
            ) {

                await this.loadTrekkerHistory();
            }


            if (
                page ===
                "trekker-profile"
            ) {

                await this.loadTrekkerProfile();
            }


            if (
                page ===
                "trekker-notifications"
            ) {

                await this.loadNotifications();
            }
        },


        // =====================================================
        // ADMIN DASHBOARD
        // =====================================================

        async loadAdminDashboard() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/dashboard"
                    );


                this.adminStats =
                    data.stats;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN TREKS
        // =====================================================

        async loadTreks() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/treks"
                    );


                this.treks =
                    data.treks;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        resetTrekForm() {

            this.trekForm = {
                id: null,
                name: "",
                location: "",
                difficulty: "Easy",
                duration: 1,
                total_slots: 1,
                description: "",
                start_date: "",
                end_date: "",
                status: "Pending"
            };


            this.trekFormMode =
                "create";
        },


        async saveTrek() {

            this.clearMessages();


            if (
                !this.trekForm.name ||
                !this.trekForm.location
            ) {

                this.errorMessage =
                    "Trek name and location are required.";

                return;
            }


            try {

                const payload = {

                    name:
                        this.trekForm.name,

                    location:
                        this.trekForm.location,

                    difficulty:
                        this.trekForm.difficulty,

                    duration:
                        Number(
                            this.trekForm.duration
                        ),

                    total_slots:
                        Number(
                            this.trekForm.total_slots
                        ),

                    description:
                        this.trekForm.description,

                    start_date:
                        this.trekForm.start_date,

                    end_date:
                        this.trekForm.end_date,

                    status:
                        this.trekForm.status
                };


                if (
                    this.trekFormMode ===
                    "create"
                ) {

                    await this.apiRequest(
                        "/api/admin/treks",
                        {
                            method: "POST",

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                    this.successMessage =
                        "Trek created successfully.";
                }

                else {

                    await this.apiRequest(
                        `/api/admin/treks/${this.trekForm.id}`,
                        {
                            method: "PUT",

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                    this.successMessage =
                        "Trek updated successfully.";
                }


                this.resetTrekForm();


                await this.loadTreks();

                await this.loadAdminDashboard();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        editTrek(trek) {

            this.clearMessages();


            this.trekFormMode =
                "edit";


            this.trekForm = {

                id:
                    trek.id,

                name:
                    trek.name,

                location:
                    trek.location,

                difficulty:
                    trek.difficulty,

                duration:
                    trek.duration,

                total_slots:
                    trek.total_slots,

                description:
                    trek.description || "",

                start_date:
                    trek.start_date || "",

                end_date:
                    trek.end_date || "",

                status:
                    trek.status
            };


            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        },


        async deleteTrek(trek) {

            const confirmed =
                confirm(
                    `Delete "${trek.name}"?`
                );


            if (!confirmed) {

                return;
            }


            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        `/api/admin/treks/${trek.id}`,
                        {
                            method: "DELETE"
                        }
                    );


                this.successMessage =
                    data.message;


                await this.loadTreks();

                await this.loadAdminDashboard();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN STAFF
        // =====================================================

        async loadStaff() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/staff"
                    );


                this.staff =
                    data.staff;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async createStaff() {

            this.clearMessages();


            if (
                !this.staffForm.name ||
                !this.staffForm.email ||
                !this.staffForm.password
            ) {

                this.errorMessage =
                    "Name, email and password are required.";

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/staff",
                        {
                            method: "POST",

                            body:
                                JSON.stringify(
                                    this.staffForm
                                )
                        }
                    );


                this.successMessage =
                    data.message;


                this.staffForm = {
                    name: "",
                    email: "",
                    password: "",
                    phone: "",
                    experience: "",
                    specialization: "",
                    emergency_contact: "",
                    address: ""
                };


                await this.loadStaff();

                await this.loadAdminDashboard();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async assignStaff() {

            this.clearMessages();


            if (
                !this.assignForm.trek_id ||
                !this.assignForm.staff_id
            ) {

                this.errorMessage =
                    "Select both trek and staff.";

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/admin/treks/${this.assignForm.trek_id}/assign-staff`,
                        {
                            method: "POST",

                            body:
                                JSON.stringify({
                                    staff_id:
                                        Number(
                                            this.assignForm.staff_id
                                        )
                                })
                        }
                    );


                this.successMessage =
                    data.message;


                this.assignForm = {
                    trek_id: "",
                    staff_id: ""
                };


                await this.loadStaff();

                await this.loadTreks();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN USERS
        // =====================================================

        async loadUsers() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/users"
                    );


                this.users =
                    data.users;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async setUserBlacklist(
            user,
            blacklisted
        ) {

            this.clearMessages();


            try {

                await this.apiRequest(
                    `/api/admin/users/${user.id}/status`,
                    {
                        method: "PATCH",

                        body:
                            JSON.stringify({
                                is_active:
                                    Boolean(
                                        user.is_active
                                    ),

                                is_blacklisted:
                                    blacklisted
                            })
                    }
                );


                this.successMessage =
                    blacklisted
                    ? `${user.name} blacklisted.`
                    : `${user.name} removed from blacklist.`;


                await this.loadUsers();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async setUserActive(
            user,
            active
        ) {

            this.clearMessages();


            try {

                await this.apiRequest(
                    `/api/admin/users/${user.id}/status`,
                    {
                        method: "PATCH",

                        body:
                            JSON.stringify({
                                is_active:
                                    active,

                                is_blacklisted:
                                    Boolean(
                                        user.is_blacklisted
                                    )
                            })
                    }
                );


                this.successMessage =
                    active
                    ? `${user.name} activated.`
                    : `${user.name} deactivated.`;


                await this.loadUsers();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN BOOKINGS
        // =====================================================

        async loadBookings() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/bookings"
                    );


                this.bookings =
                    data.bookings;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN SEARCH
        // =====================================================

        async performSearch() {

            this.clearMessages();


            if (
                !this.searchQuery.trim()
            ) {

                this.searchResults = {
                    treks: [],
                    users: [],
                    staff: []
                };

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/admin/search?q=${encodeURIComponent(
                            this.searchQuery
                        )}`
                    );


                this.searchResults = {
                    treks:
                        data.treks,

                    users:
                        data.users,

                    staff:
                        data.staff
                };

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // STAFF DASHBOARD
        // =====================================================

        async loadStaffDashboard() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/staff/dashboard"
                    );


                this.staffStats =
                    data.stats;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // STAFF TREKS
        // =====================================================

        async loadStaffTreks() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/staff/treks"
                    );


                this.staffTreks =
                    data.treks;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        selectStaffTrek(trek) {

            this.clearMessages();


            this.selectedStaffTrek = {
                ...trek
            };


            this.staffSlotForm.total_slots =
                trek.total_slots;


            this.currentPage =
                "staff-manage-trek";
        },


        async updateStaffSlots() {

            this.clearMessages();


            if (
                !this.selectedStaffTrek
            ) {

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/staff/treks/${this.selectedStaffTrek.id}/slots`,
                        {
                            method: "PATCH",

                            body:
                                JSON.stringify({
                                    total_slots:
                                        Number(
                                            this.staffSlotForm.total_slots
                                        )
                                })
                        }
                    );


                this.successMessage =
                    data.message;


                this.selectedStaffTrek.total_slots =
                    data.total_slots;


                this.selectedStaffTrek.available_slots =
                    data.available_slots;


                await this.loadStaffTreks();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async updateStaffStatus(
            status
        ) {

            this.clearMessages();


            if (
                !this.selectedStaffTrek
            ) {

                return;
            }


            const confirmed =
                confirm(
                    `Change trek status to ${status}?`
                );


            if (!confirmed) {

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/staff/treks/${this.selectedStaffTrek.id}/status`,
                        {
                            method: "PATCH",

                            body:
                                JSON.stringify({
                                    status:
                                        status
                                })
                        }
                    );


                this.successMessage =
                    data.message;


                this.selectedStaffTrek.status =
                    status;


                await this.loadStaffTreks();

                await this.loadStaffDashboard();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // STAFF PARTICIPANTS
        // =====================================================

        async loadStaffParticipants() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/staff/participants"
                    );


                this.staffParticipants =
                    data.participants;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async viewTrekParticipants(
            trek
        ) {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        `/api/staff/treks/${trek.id}/participants`
                    );


                this.selectedStaffTrek =
                    trek;


                this.staffParticipants =
                    data.participants;


                this.currentPage =
                    "staff-participants";

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // STAFF PROFILE
        // =====================================================

        async loadStaffProfile() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/staff/profile"
                    );


                this.staffProfile =
                    data.profile;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // TREKKER DASHBOARD
        // =====================================================

        async loadTrekkerDashboard() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/trekker/dashboard"
                    );


                this.trekkerStats =
                    data.stats;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // TREKKER AVAILABLE TREKS
        // =====================================================

        async loadAvailableTreks() {

            this.clearMessages();


            try {

                const parameters =
                    new URLSearchParams();


                if (
                    this.trekFilters.search.trim()
                ) {

                    parameters.append(
                        "search",
                        this.trekFilters.search.trim()
                    );
                }


                if (
                    this.trekFilters.difficulty
                ) {

                    parameters.append(
                        "difficulty",
                        this.trekFilters.difficulty
                    );
                }


                if (
                    this.trekFilters.location.trim()
                ) {

                    parameters.append(
                        "location",
                        this.trekFilters.location.trim()
                    );
                }


                if (
                    this.trekFilters.duration
                ) {

                    parameters.append(
                        "duration",
                        this.trekFilters.duration
                    );
                }


                let url =
                    "/api/trekker/treks";


                const queryString =
                    parameters.toString();


                if (queryString) {

                    url +=
                        `?${queryString}`;
                }


                const data =
                    await this.apiRequest(
                        url
                    );


                this.availableTreks =
                    data.treks;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        clearTrekFilters() {

            this.trekFilters = {
                search: "",
                difficulty: "",
                location: "",
                duration: ""
            };


            this.loadAvailableTreks();
        },


        // =====================================================
        // TREK DETAILS
        // =====================================================

        async viewTrekDetails(
            trek
        ) {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        `/api/trekker/treks/${trek.id}`
                    );


                this.selectedTrek =
                    data.trek;


                this.currentPage =
                    "trekker-trek-details";

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // BOOK TREK
        // =====================================================

        async bookTrek(trek) {

            this.clearMessages();


            const confirmed =
                confirm(
                    `Book "${trek.name}"?`
                );


            if (!confirmed) {

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/trekker/treks/${trek.id}/book`,
                        {
                            method: "POST"
                        }
                    );


                this.successMessage =
                    data.message;


                await this.loadTrekkerDashboard();


                if (
                    this.currentPage ===
                    "trekker-treks"
                ) {

                    await this.loadAvailableTreks();
                }


                if (
                    this.selectedTrek &&
                    this.selectedTrek.id === trek.id
                ) {

                    const details =
                        await this.apiRequest(
                            `/api/trekker/treks/${trek.id}`
                        );


                    this.selectedTrek =
                        details.trek;
                }

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // TREKKER BOOKINGS
        // =====================================================

        async loadTrekkerBookings() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/trekker/bookings"
                    );


                this.trekkerBookings =
                    data.bookings;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async cancelBooking(
            booking
        ) {

            this.clearMessages();


            const confirmed =
                confirm(
                    `Cancel booking for "${booking.trek_name}"?`
                );


            if (!confirmed) {

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/trekker/bookings/${booking.id}/cancel`,
                        {
                            method: "PATCH"
                        }
                    );


                this.successMessage =
                    data.message;


                await this.loadTrekkerBookings();

                await this.loadTrekkerDashboard();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // TREKKER HISTORY
        // =====================================================

        async loadTrekkerHistory() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/trekker/history"
                    );


                this.trekkerHistory =
                    data.history;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // TREKKER PROFILE
        // =====================================================

        async loadTrekkerProfile() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/trekker/profile"
                    );


                this.trekkerProfile =
                    data.profile;


                this.trekkerProfileForm = {
                    name:
                        data.profile.name,

                    phone:
                        data.profile.phone || ""
                };

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async updateTrekkerProfile() {

            this.clearMessages();


            if (
                !this.trekkerProfileForm.name.trim()
            ) {

                this.errorMessage =
                    "Name is required.";

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        "/api/trekker/profile",
                        {
                            method: "PUT",

                            body:
                                JSON.stringify({
                                    name:
                                        this.trekkerProfileForm.name,

                                    phone:
                                        this.trekkerProfileForm.phone
                                })
                        }
                    );


                this.trekkerProfile =
                    data.profile;


                this.currentUser.name =
                    data.profile.name;


                this.successMessage =
                    data.message;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // START CELERY CSV EXPORT
        // =====================================================

        async startHistoryExport() {

            this.clearMessages();


            try {

                const data =
                    await this.apiRequest(
                        "/api/jobs/trekker/history-export",
                        {
                            method: "POST"
                        }
                    );


                this.exportJob = {
                    id:
                        data.job_id,

                    status:
                        "Pending",

                    file_name:
                        null
                };


                this.successMessage =
                    "CSV export started in background.";


                await this.checkExportStatus();

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // CHECK CELERY EXPORT STATUS
        // =====================================================

        async checkExportStatus() {

            if (!this.exportJob) {

                return;
            }


            try {

                const data =
                    await this.apiRequest(
                        `/api/jobs/trekker/history-export/${this.exportJob.id}`
                    );


                this.exportJob =
                    data.job;


                if (
                    data.job.status ===
                    "Pending" ||
                    data.job.status ===
                    "Processing"
                ) {

                    setTimeout(
                        () => {
                            this.checkExportStatus();
                        },
                        2000
                    );
                }


                else if (
                    data.job.status ===
                    "Completed"
                ) {

                    this.successMessage =
                        "CSV export completed successfully.";


                    await this.loadNotifications();
                }


                else if (
                    data.job.status ===
                    "Failed"
                ) {

                    this.errorMessage =
                        data.job.error_message ||
                        "CSV export failed.";
                }

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // DOWNLOAD CSV
        // =====================================================

        async downloadHistoryExport() {

            if (
                !this.exportJob ||
                this.exportJob.status !==
                "Completed"
            ) {

                return;
            }


            try {

                const response = await fetch(
                    `/api/jobs/trekker/history-export/${this.exportJob.id}/download`,
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${this.token}`
                        }
                    }
                );


                if (!response.ok) {

                    let message =
                        "Download failed.";


                    try {

                        const data =
                            await response.json();


                        message =
                            data.message ||
                            message;

                    } catch (error) {
                    }


                    throw new Error(
                        message
                    );
                }


                const blob =
                    await response.blob();


                const url =
                    window.URL.createObjectURL(
                        blob
                    );


                const link =
                    document.createElement(
                        "a"
                    );


                link.href = url;


                link.download =
                    this.exportJob.file_name ||
                    "trek_history.csv";


                document.body.appendChild(
                    link
                );


                link.click();


                link.remove();


                window.URL.revokeObjectURL(
                    url
                );

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // NOTIFICATIONS
        // =====================================================

        async loadNotifications() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/jobs/notifications"
                    );


                this.notifications =
                    data.notifications;


                this.unreadNotifications =
                    this.notifications.filter(
                        notification =>
                            !notification.is_read
                    ).length;

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async markNotificationRead(
            notification
        ) {

            if (
                notification.is_read
            ) {

                return;
            }


            try {

                await this.apiRequest(
                    `/api/jobs/notifications/${notification.id}/read`,
                    {
                        method: "PATCH"
                    }
                );


                notification.is_read = 1;


                this.unreadNotifications =
                    Math.max(
                        0,
                        this.unreadNotifications - 1
                    );

            } catch (error) {

                this.errorMessage =
                    error.message;
            }
        }
    },


    // =========================================================
    // VUE TEMPLATE
    // =========================================================

    template: `

    <div>

        <!-- ================================================= -->
        <!-- LOGIN PAGE -->
        <!-- ================================================= -->

        <div
            v-if="currentPage === 'login'"
            class="auth-container"
        >

            <div class="card auth-card">

                <div class="card-body p-4">

                    <h2 class="fw-bold text-center">
                        Trekking Management
                    </h2>


                    <p class="text-muted text-center">
                        Login to continue
                    </p>


                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <div
                        v-if="successMessage"
                        class="alert alert-success"
                    >
                        {{ successMessage }}
                    </div>


                    <form
                        @submit.prevent="login"
                    >

                        <div class="mb-3">

                            <label class="form-label">
                                Email
                            </label>

                            <input
                                v-model.trim="loginForm.email"
                                type="email"
                                class="form-control"
                                placeholder="Enter email"
                            >

                        </div>


                        <div class="mb-3">

                            <label class="form-label">
                                Password
                            </label>

                            <input
                                v-model="loginForm.password"
                                type="password"
                                class="form-control"
                                placeholder="Enter password"
                            >

                        </div>


                        <button
                            class="btn btn-primary w-100"
                            :disabled="loading"
                        >

                            {{
                                loading
                                ? "Logging in..."
                                : "Login"
                            }}

                        </button>

                    </form>


                    <hr>


                    <div class="text-center">

                        New Trekker?

                        <button
                            class="btn btn-link p-0"
                            @click="
                                currentPage='register';
                                clearMessages();
                            "
                        >
                            Create Account
                        </button>

                    </div>

                </div>

            </div>

        </div>



        <!-- ================================================= -->
        <!-- REGISTER PAGE -->
        <!-- ================================================= -->

        <div
            v-else-if="
                currentPage ===
                'register'
            "
            class="auth-container"
        >

            <div class="card auth-card">

                <div class="card-body p-4">

                    <h2 class="fw-bold text-center">
                        Trekker Registration
                    </h2>


                    <p class="text-muted text-center">
                        Create your trekking account
                    </p>


                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <form
                        @submit.prevent="register"
                    >

                        <input
                            v-model.trim="registerForm.name"
                            class="form-control mb-3"
                            placeholder="Full Name"
                        >


                        <input
                            v-model.trim="registerForm.email"
                            type="email"
                            class="form-control mb-3"
                            placeholder="Email"
                        >


                        <input
                            v-model.trim="registerForm.phone"
                            class="form-control mb-3"
                            placeholder="Phone"
                        >


                        <input
                            v-model="registerForm.password"
                            type="password"
                            class="form-control mb-3"
                            placeholder="Password"
                        >


                        <input
                            v-model="registerForm.confirmPassword"
                            type="password"
                            class="form-control mb-3"
                            placeholder="Confirm Password"
                        >


                        <button
                            class="btn btn-success w-100"
                            :disabled="loading"
                        >
                            Register
                        </button>

                    </form>


                    <hr>


                    <button
                        class="btn btn-link w-100"
                        @click="
                            currentPage='login';
                            clearMessages();
                        "
                    >
                        Back to Login
                    </button>

                </div>

            </div>

        </div>



        <!-- ================================================= -->
        <!-- LOGGED IN APPLICATION -->
        <!-- ================================================= -->

        <div
            v-else
            class="app-container"
        >

            <!-- NAVBAR -->

            <nav
                class="navbar navbar-dark bg-dark px-3 app-navbar"
            >

                <span class="navbar-brand fw-bold">
                    Trekking Management V2
                </span>


                <div
                    class="d-flex align-items-center"
                >

                    <span
                        v-if="currentUser"
                        class="text-light"
                    >

                        {{ currentUser.name }}

                        |

                        {{ currentUser.role }}

                    </span>


                    <button
                        class="btn btn-outline-light btn-sm ms-3"
                        @click="logout"
                    >
                        Logout
                    </button>

                </div>

            </nav>



            <div class="container-fluid">

                <div class="row">


                    <!-- ================================================= -->
                    <!-- ADMIN SIDEBAR -->
                    <!-- ================================================= -->

                    <aside
                        v-if="
                            currentUser &&
                            currentUser.role === 'Admin'
                        "
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-white mb-3">
                            ADMIN PANEL
                        </h6>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'admin-dashboard'
                            }"
                            @click="
                                navigate(
                                    'admin-dashboard'
                                )
                            "
                        >
                            Dashboard
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'admin-treks'
                            }"
                            @click="
                                navigate(
                                    'admin-treks'
                                )
                            "
                        >
                            Manage Treks
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'admin-staff'
                            }"
                            @click="
                                navigate(
                                    'admin-staff'
                                )
                            "
                        >
                            Trek Staff
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'admin-users'
                            }"
                            @click="
                                navigate(
                                    'admin-users'
                                )
                            "
                        >
                            Users
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'admin-bookings'
                            }"
                            @click="
                                navigate(
                                    'admin-bookings'
                                )
                            "
                        >
                            Bookings
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'admin-search'
                            }"
                            @click="
                                navigate(
                                    'admin-search'
                                )
                            "
                        >
                            Search
                        </button>

                    </aside>



                    <!-- ================================================= -->
                    <!-- STAFF SIDEBAR -->
                    <!-- ================================================= -->

                    <aside
                        v-if="
                            currentUser &&
                            currentUser.role === 'Staff'
                        "
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-white mb-3">
                            TREK STAFF
                        </h6>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'staff-dashboard'
                            }"
                            @click="
                                navigate(
                                    'staff-dashboard'
                                )
                            "
                        >
                            Dashboard
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'staff-treks' ||
                                currentPage ===
                                'staff-manage-trek'
                            }"
                            @click="
                                navigate(
                                    'staff-treks'
                                )
                            "
                        >
                            My Treks
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'staff-participants'
                            }"
                            @click="
                                navigate(
                                    'staff-participants'
                                )
                            "
                        >
                            Participants
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'staff-profile'
                            }"
                            @click="
                                navigate(
                                    'staff-profile'
                                )
                            "
                        >
                            Profile
                        </button>

                    </aside>



                    <!-- ================================================= -->
                    <!-- TREKKER SIDEBAR -->
                    <!-- ================================================= -->

                    <aside
                        v-if="
                            currentUser &&
                            currentUser.role === 'Trekker'
                        "
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-white mb-3">
                            TREKKER
                        </h6>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'trekker-dashboard'
                            }"
                            @click="
                                navigate(
                                    'trekker-dashboard'
                                )
                            "
                        >
                            Dashboard
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'trekker-treks' ||
                                currentPage ===
                                'trekker-trek-details'
                            }"
                            @click="
                                navigate(
                                    'trekker-treks'
                                )
                            "
                        >
                            Browse Treks
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'trekker-bookings'
                            }"
                            @click="
                                navigate(
                                    'trekker-bookings'
                                )
                            "
                        >
                            My Bookings
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'trekker-history'
                            }"
                            @click="
                                navigate(
                                    'trekker-history'
                                )
                            "
                        >
                            History
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'trekker-profile'
                            }"
                            @click="
                                navigate(
                                    'trekker-profile'
                                )
                            "
                        >
                            Profile
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{
                                active:
                                currentPage ===
                                'trekker-notifications'
                            }"
                            @click="
                                navigate(
                                    'trekker-notifications'
                                )
                            "
                        >

                            Notifications


                            <span
                                v-if="
                                    unreadNotifications > 0
                                "
                                class="badge bg-danger ms-1"
                            >
                                {{ unreadNotifications }}
                            </span>

                        </button>

                    </aside>



                    <!-- ================================================= -->
                    <!-- MAIN CONTENT -->
                    <!-- ================================================= -->

                    <main
                        class="col-md-10 main-content"
                    >


                        <div
                            v-if="errorMessage"
                            class="alert alert-danger"
                        >
                            {{ errorMessage }}
                        </div>


                        <div
                            v-if="successMessage"
                            class="alert alert-success"
                        >
                            {{ successMessage }}
                        </div>



                        <!-- ============================================= -->
                        <!-- ADMIN DASHBOARD -->
                        <!-- ============================================= -->

                        <div
                            v-if="
                                currentPage ===
                                'admin-dashboard'
                            "
                        >

                            <h2 class="fw-bold mb-4">
                                Admin Dashboard
                            </h2>


                            <div class="row g-3">


                                <div class="col-md-4 col-lg-2">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Total Treks
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg-2">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_staff }}
                                            </h3>

                                            <span class="text-muted">
                                                Staff
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg-2">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_trekkers }}
                                            </h3>

                                            <span class="text-muted">
                                                Trekkers
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg-2">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_bookings }}
                                            </h3>

                                            <span class="text-muted">
                                                Bookings
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg-2">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.open_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Open
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg-2">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.completed_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Completed
                                            </span>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- ADMIN TREKS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'admin-treks'
                            "
                        >

                            <h2 class="fw-bold">
                                Manage Treks
                            </h2>


                            <div class="card dashboard-card my-4">

                                <div class="card-body">

                                    <h5>

                                        {{
                                            trekFormMode ===
                                            'create'
                                            ? 'Create New Trek'
                                            : 'Edit Trek'
                                        }}

                                    </h5>


                                    <form
                                        @submit.prevent="
                                            saveTrek
                                        "
                                    >

                                        <div class="row g-3">


                                            <div class="col-md-6">

                                                <label class="form-label">
                                                    Trek Name
                                                </label>

                                                <input
                                                    v-model.trim="trekForm.name"
                                                    class="form-control"
                                                >

                                            </div>


                                            <div class="col-md-6">

                                                <label class="form-label">
                                                    Location
                                                </label>

                                                <input
                                                    v-model.trim="trekForm.location"
                                                    class="form-control"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Difficulty
                                                </label>

                                                <select
                                                    v-model="trekForm.difficulty"
                                                    class="form-select"
                                                >

                                                    <option>
                                                        Easy
                                                    </option>

                                                    <option>
                                                        Moderate
                                                    </option>

                                                    <option>
                                                        Hard
                                                    </option>

                                                </select>

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Duration
                                                </label>

                                                <input
                                                    v-model.number="trekForm.duration"
                                                    type="number"
                                                    min="1"
                                                    class="form-control"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Total Slots
                                                </label>

                                                <input
                                                    v-model.number="trekForm.total_slots"
                                                    type="number"
                                                    min="1"
                                                    class="form-control"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Start Date
                                                </label>

                                                <input
                                                    v-model="trekForm.start_date"
                                                    type="date"
                                                    class="form-control"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    End Date
                                                </label>

                                                <input
                                                    v-model="trekForm.end_date"
                                                    type="date"
                                                    class="form-control"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Status
                                                </label>

                                                <select
                                                    v-model="trekForm.status"
                                                    class="form-select"
                                                >

                                                    <option>
                                                        Pending
                                                    </option>

                                                    <option>
                                                        Approved
                                                    </option>

                                                    <option>
                                                        Open
                                                    </option>

                                                    <option>
                                                        Closed
                                                    </option>

                                                    <option>
                                                        Ongoing
                                                    </option>

                                                    <option>
                                                        Completed
                                                    </option>

                                                </select>

                                            </div>


                                            <div class="col-12">

                                                <label class="form-label">
                                                    Description
                                                </label>

                                                <textarea
                                                    v-model.trim="trekForm.description"
                                                    class="form-control"
                                                    rows="3"
                                                ></textarea>

                                            </div>


                                            <div class="col-12">

                                                <button
                                                    class="btn btn-primary"
                                                >

                                                    {{
                                                        trekFormMode ===
                                                        'create'
                                                        ? 'Create Trek'
                                                        : 'Save Changes'
                                                    }}

                                                </button>


                                                <button
                                                    v-if="
                                                        trekFormMode ===
                                                        'edit'
                                                    "
                                                    type="button"
                                                    class="btn btn-secondary ms-2"
                                                    @click="
                                                        resetTrekForm
                                                    "
                                                >
                                                    Cancel Edit
                                                </button>

                                            </div>

                                        </div>

                                    </form>

                                </div>

                            </div>


                            <div
                                class="table-responsive table-container"
                            >

                                <table
                                    class="table table-hover align-middle"
                                >

                                    <thead>

                                        <tr>
                                            <th>ID</th>
                                            <th>Trek</th>
                                            <th>Location</th>
                                            <th>Difficulty</th>
                                            <th>Slots</th>
                                            <th>Staff</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="
                                                trek in treks
                                            "
                                            :key="trek.id"
                                        >

                                            <td>
                                                {{ trek.id }}
                                            </td>

                                            <td>
                                                {{ trek.name }}
                                            </td>

                                            <td>
                                                {{ trek.location }}
                                            </td>

                                            <td>
                                                {{ trek.difficulty }}
                                            </td>

                                            <td>

                                                {{ trek.available_slots }}

                                                /

                                                {{ trek.total_slots }}

                                            </td>

                                            <td>

                                                {{
                                                    trek.assigned_staff
                                                    ||
                                                    'Not Assigned'
                                                }}

                                            </td>

                                            <td>

                                                <span
                                                    class="badge bg-secondary"
                                                >
                                                    {{ trek.status }}
                                                </span>

                                            </td>

                                            <td>

                                                <button
                                                    class="btn btn-warning btn-sm me-2"
                                                    @click="
                                                        editTrek(
                                                            trek
                                                        )
                                                    "
                                                >
                                                    Edit
                                                </button>


                                                <button
                                                    class="btn btn-danger btn-sm"
                                                    @click="
                                                        deleteTrek(
                                                            trek
                                                        )
                                                    "
                                                >
                                                    Delete
                                                </button>

                                            </td>

                                        </tr>


                                        <tr
                                            v-if="
                                                treks.length === 0
                                            "
                                        >

                                            <td
                                                colspan="8"
                                                class="text-center text-muted"
                                            >
                                                No treks found.
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- ADMIN STAFF -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'admin-staff'
                            "
                        >

                            <h2 class="fw-bold">
                                Trek Staff
                            </h2>


                            <div class="row g-4 my-4">


                                <div class="col-lg-7">

                                    <div class="card dashboard-card">

                                        <div class="card-body">

                                            <h5>
                                                Create Staff
                                            </h5>


                                            <form
                                                @submit.prevent="
                                                    createStaff
                                                "
                                            >

                                                <div class="row g-3">


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.name"
                                                            class="form-control"
                                                            placeholder="Name"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.email"
                                                            type="email"
                                                            class="form-control"
                                                            placeholder="Email"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model="staffForm.password"
                                                            type="password"
                                                            class="form-control"
                                                            placeholder="Password"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.phone"
                                                            class="form-control"
                                                            placeholder="Phone"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.experience"
                                                            class="form-control"
                                                            placeholder="Experience"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.specialization"
                                                            class="form-control"
                                                            placeholder="Specialization"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.emergency_contact"
                                                            class="form-control"
                                                            placeholder="Emergency Contact"
                                                        >

                                                    </div>


                                                    <div class="col-md-6">

                                                        <input
                                                            v-model.trim="staffForm.address"
                                                            class="form-control"
                                                            placeholder="Address"
                                                        >

                                                    </div>


                                                    <div class="col-12">

                                                        <button
                                                            class="btn btn-success"
                                                        >
                                                            Create Staff
                                                        </button>

                                                    </div>

                                                </div>

                                            </form>

                                        </div>

                                    </div>

                                </div>



                                <div class="col-lg-5">

                                    <div class="card dashboard-card">

                                        <div class="card-body">

                                            <h5>
                                                Assign Staff
                                            </h5>


                                            <select
                                                v-model="
                                                    assignForm.trek_id
                                                "
                                                class="form-select mb-3"
                                            >

                                                <option value="">
                                                    Select Trek
                                                </option>


                                                <option
                                                    v-for="
                                                        trek in treks
                                                    "
                                                    :key="trek.id"
                                                    :value="trek.id"
                                                >
                                                    {{ trek.name }}
                                                </option>

                                            </select>


                                            <select
                                                v-model="
                                                    assignForm.staff_id
                                                "
                                                class="form-select mb-3"
                                            >

                                                <option value="">
                                                    Select Staff
                                                </option>


                                                <option
                                                    v-for="
                                                        person in staff
                                                    "
                                                    :key="person.id"
                                                    :value="person.id"
                                                >
                                                    {{ person.name }}
                                                </option>

                                            </select>


                                            <button
                                                class="btn btn-primary"
                                                @click="
                                                    assignStaff
                                                "
                                            >
                                                Assign Staff
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <div
                                class="table-responsive table-container"
                            >

                                <table class="table">

                                    <thead>

                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Specialization</th>
                                            <th>Assigned Treks</th>
                                            <th>Status</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="
                                                person in staff
                                            "
                                            :key="person.id"
                                        >

                                            <td>
                                                {{ person.id }}
                                            </td>

                                            <td>
                                                {{ person.name }}
                                            </td>

                                            <td>
                                                {{ person.email }}
                                            </td>

                                            <td>

                                                {{
                                                    person.specialization
                                                    ||
                                                    '-'
                                                }}

                                            </td>

                                            <td>
                                                {{ person.assigned_treks }}
                                            </td>

                                            <td>

                                                <span
                                                    v-if="
                                                        person.is_blacklisted
                                                    "
                                                    class="badge bg-danger"
                                                >
                                                    Blacklisted
                                                </span>


                                                <span
                                                    v-else-if="
                                                        person.is_active
                                                    "
                                                    class="badge bg-success"
                                                >
                                                    Active
                                                </span>


                                                <span
                                                    v-else
                                                    class="badge bg-secondary"
                                                >
                                                    Inactive
                                                </span>

                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- ADMIN USERS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'admin-users'
                            "
                        >

                            <h2 class="fw-bold mb-4">
                                Manage Users
                            </h2>


                            <div
                                class="table-responsive table-container"
                            >

                                <table class="table table-hover">

                                    <thead>

                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Email</th>
                                            <th>Active</th>
                                            <th>Blacklisted</th>
                                            <th>Actions</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="
                                                user in users
                                            "
                                            :key="user.id"
                                        >

                                            <td>
                                                {{ user.id }}
                                            </td>

                                            <td>
                                                {{ user.name }}
                                            </td>

                                            <td>
                                                {{ user.role }}
                                            </td>

                                            <td>
                                                {{ user.email }}
                                            </td>

                                            <td>

                                                {{
                                                    user.is_active
                                                    ? 'Yes'
                                                    : 'No'
                                                }}

                                            </td>

                                            <td>

                                                {{
                                                    user.is_blacklisted
                                                    ? 'Yes'
                                                    : 'No'
                                                }}

                                            </td>

                                            <td>

                                                <button
                                                    v-if="
                                                        user.is_active
                                                    "
                                                    class="btn btn-secondary btn-sm me-1"
                                                    @click="
                                                        setUserActive(
                                                            user,
                                                            false
                                                        )
                                                    "
                                                >
                                                    Deactivate
                                                </button>


                                                <button
                                                    v-else
                                                    class="btn btn-success btn-sm me-1"
                                                    @click="
                                                        setUserActive(
                                                            user,
                                                            true
                                                        )
                                                    "
                                                >
                                                    Activate
                                                </button>


                                                <button
                                                    v-if="
                                                        !user.is_blacklisted
                                                    "
                                                    class="btn btn-danger btn-sm"
                                                    @click="
                                                        setUserBlacklist(
                                                            user,
                                                            true
                                                        )
                                                    "
                                                >
                                                    Blacklist
                                                </button>


                                                <button
                                                    v-else
                                                    class="btn btn-warning btn-sm"
                                                    @click="
                                                        setUserBlacklist(
                                                            user,
                                                            false
                                                        )
                                                    "
                                                >
                                                    Remove Blacklist
                                                </button>

                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- ADMIN BOOKINGS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'admin-bookings'
                            "
                        >

                            <h2 class="fw-bold mb-4">
                                All Bookings
                            </h2>


                            <div
                                class="table-responsive table-container"
                            >

                                <table class="table">

                                    <thead>

                                        <tr>
                                            <th>ID</th>
                                            <th>User</th>
                                            <th>Trek</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                            <th>Payment</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="
                                                booking in bookings
                                            "
                                            :key="booking.id"
                                        >

                                            <td>
                                                {{ booking.id }}
                                            </td>

                                            <td>
                                                {{ booking.user_name }}
                                            </td>

                                            <td>
                                                {{ booking.trek_name }}
                                            </td>

                                            <td>
                                                {{ booking.booking_date }}
                                            </td>

                                            <td>
                                                {{ booking.status }}
                                            </td>

                                            <td>
                                                {{ booking.payment_status }}
                                            </td>

                                        </tr>


                                        <tr
                                            v-if="
                                                bookings.length === 0
                                            "
                                        >

                                            <td
                                                colspan="6"
                                                class="text-center text-muted"
                                            >
                                                No bookings yet.
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- ADMIN SEARCH -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'admin-search'
                            "
                        >

                            <h2 class="fw-bold">
                                Search
                            </h2>


                            <div
                                class="input-group my-4"
                            >

                                <input
                                    v-model.trim="
                                        searchQuery
                                    "
                                    class="form-control"
                                    placeholder="Search trek, user or staff..."
                                    @keyup.enter="
                                        performSearch
                                    "
                                >


                                <button
                                    class="btn btn-primary"
                                    @click="
                                        performSearch
                                    "
                                >
                                    Search
                                </button>

                            </div>


                            <h5>
                                Treks
                            </h5>


                            <div
                                v-for="
                                    trek in searchResults.treks
                                "
                                :key="
                                    'trek-' + trek.id
                                "
                                class="card mb-2"
                            >

                                <div class="card-body">

                                    <strong>
                                        {{ trek.name }}
                                    </strong>

                                    -

                                    {{ trek.location }}

                                </div>

                            </div>


                            <h5 class="mt-4">
                                Trekkers
                            </h5>


                            <div
                                v-for="
                                    user in searchResults.users
                                "
                                :key="
                                    'user-' + user.id
                                "
                                class="card mb-2"
                            >

                                <div class="card-body">

                                    <strong>
                                        {{ user.name }}
                                    </strong>

                                    -

                                    {{ user.email }}

                                </div>

                            </div>


                            <h5 class="mt-4">
                                Staff
                            </h5>


                            <div
                                v-for="
                                    person in searchResults.staff
                                "
                                :key="
                                    'staff-' + person.id
                                "
                                class="card mb-2"
                            >

                                <div class="card-body">

                                    <strong>
                                        {{ person.name }}
                                    </strong>

                                    -

                                    {{ person.email }}

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- STAFF DASHBOARD -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'staff-dashboard'
                            "
                        >

                            <h2 class="fw-bold">
                                Trek Staff Dashboard
                            </h2>


                            <p class="text-muted">
                                Manage your assigned trekking routes.
                            </p>


                            <div class="row g-3 mt-3">


                                <div class="col">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.assigned_treks }}
                                            </h3>

                                            Assigned Treks

                                        </div>

                                    </div>

                                </div>


                                <div class="col">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.open_treks }}
                                            </h3>

                                            Open

                                        </div>

                                    </div>

                                </div>


                                <div class="col">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.ongoing_treks }}
                                            </h3>

                                            Ongoing

                                        </div>

                                    </div>

                                </div>


                                <div class="col">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.completed_treks }}
                                            </h3>

                                            Completed

                                        </div>

                                    </div>

                                </div>


                                <div class="col">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.total_participants }}
                                            </h3>

                                            Participants

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- STAFF TREKS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'staff-treks'
                            "
                        >

                            <h2 class="fw-bold">
                                My Assigned Treks
                            </h2>


                            <div class="row g-4 mt-2">


                                <div
                                    v-for="
                                        trek in staffTreks
                                    "
                                    :key="trek.id"
                                    class="col-lg-6"
                                >

                                    <div class="card dashboard-card">

                                        <div class="card-body">

                                            <h4>
                                                {{ trek.name }}
                                            </h4>


                                            <p class="text-muted">
                                                {{ trek.location }}
                                            </p>


                                            <p>

                                                <strong>
                                                    Status:
                                                </strong>

                                                {{ trek.status }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Slots:
                                                </strong>

                                                {{ trek.available_slots }}

                                                /

                                                {{ trek.total_slots }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Participants:
                                                </strong>

                                                {{ trek.participant_count }}

                                            </p>


                                            <button
                                                class="btn btn-primary me-2"
                                                @click="
                                                    selectStaffTrek(
                                                        trek
                                                    )
                                                "
                                            >
                                                Manage Trek
                                            </button>


                                            <button
                                                class="btn btn-outline-secondary"
                                                @click="
                                                    viewTrekParticipants(
                                                        trek
                                                    )
                                                "
                                            >
                                                Participants
                                            </button>

                                        </div>

                                    </div>

                                </div>


                                <div
                                    v-if="
                                        staffTreks.length === 0
                                    "
                                    class="col-12"
                                >

                                    <div
                                        class="alert alert-info"
                                    >
                                        No treks assigned to you.
                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- STAFF MANAGE TREK -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'staff-manage-trek'
                            "
                        >

                            <button
                                class="btn btn-outline-secondary mb-3"
                                @click="
                                    navigate(
                                        'staff-treks'
                                    )
                                "
                            >
                                ← Back
                            </button>


                            <div
                                v-if="
                                    selectedStaffTrek
                                "
                            >

                                <h2 class="fw-bold">

                                    {{ selectedStaffTrek.name }}

                                </h2>


                                <p class="text-muted">
                                    {{ selectedStaffTrek.location }}
                                </p>


                                <div class="row g-4">


                                    <div class="col-md-6">

                                        <div class="card dashboard-card">

                                            <div class="card-body">

                                                <h5>
                                                    Trek Information
                                                </h5>


                                                <p>

                                                    <strong>
                                                        Difficulty:
                                                    </strong>

                                                    {{ selectedStaffTrek.difficulty }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        Duration:
                                                    </strong>

                                                    {{ selectedStaffTrek.duration }}

                                                    days

                                                </p>


                                                <p>

                                                    <strong>
                                                        Status:
                                                    </strong>

                                                    {{ selectedStaffTrek.status }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        Slots:
                                                    </strong>

                                                    {{ selectedStaffTrek.available_slots }}

                                                    /

                                                    {{ selectedStaffTrek.total_slots }}

                                                </p>

                                            </div>

                                        </div>

                                    </div>



                                    <div class="col-md-6">

                                        <div
                                            class="card dashboard-card mb-3"
                                        >

                                            <div class="card-body">

                                                <h5>
                                                    Update Slots
                                                </h5>


                                                <input
                                                    v-model.number="
                                                        staffSlotForm.total_slots
                                                    "
                                                    type="number"
                                                    min="1"
                                                    class="form-control mb-3"
                                                >


                                                <button
                                                    class="btn btn-primary"
                                                    @click="
                                                        updateStaffSlots
                                                    "
                                                >
                                                    Update Slots
                                                </button>

                                            </div>

                                        </div>


                                        <div
                                            class="card dashboard-card"
                                        >

                                            <div class="card-body">

                                                <h5>
                                                    Trek Status
                                                </h5>


                                                <button
                                                    class="btn btn-success me-1 mb-1"
                                                    @click="
                                                        updateStaffStatus(
                                                            'Open'
                                                        )
                                                    "
                                                >
                                                    Open
                                                </button>


                                                <button
                                                    class="btn btn-secondary me-1 mb-1"
                                                    @click="
                                                        updateStaffStatus(
                                                            'Closed'
                                                        )
                                                    "
                                                >
                                                    Close
                                                </button>


                                                <button
                                                    class="btn btn-warning me-1 mb-1"
                                                    @click="
                                                        updateStaffStatus(
                                                            'Ongoing'
                                                        )
                                                    "
                                                >
                                                    Ongoing
                                                </button>


                                                <button
                                                    class="btn btn-primary mb-1"
                                                    @click="
                                                        updateStaffStatus(
                                                            'Completed'
                                                        )
                                                    "
                                                >
                                                    Complete
                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- STAFF PARTICIPANTS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'staff-participants'
                            "
                        >

                            <h2 class="fw-bold">
                                Participants
                            </h2>


                            <div
                                class="table-responsive table-container mt-4"
                            >

                                <table class="table">

                                    <thead>

                                        <tr>
                                            <th>Booking</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Trek</th>
                                            <th>Status</th>
                                            <th>Payment</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="
                                                participant
                                                in staffParticipants
                                            "
                                            :key="
                                                participant.booking_id
                                            "
                                        >

                                            <td>
                                                #{{ participant.booking_id }}
                                            </td>


                                            <td>

                                                {{
                                                    participant.user_name
                                                    ||
                                                    participant.name
                                                }}

                                            </td>


                                            <td>

                                                {{
                                                    participant.user_email
                                                    ||
                                                    participant.email
                                                }}

                                            </td>


                                            <td>

                                                {{
                                                    participant.user_phone
                                                    ||
                                                    participant.phone
                                                    ||
                                                    '-'
                                                }}

                                            </td>


                                            <td>

                                                {{
                                                    participant.trek_name
                                                    ||
                                                    (
                                                        selectedStaffTrek
                                                        ? selectedStaffTrek.name
                                                        : '-'
                                                    )
                                                }}

                                            </td>


                                            <td>
                                                {{ participant.booking_status }}
                                            </td>


                                            <td>
                                                {{ participant.payment_status }}
                                            </td>

                                        </tr>


                                        <tr
                                            v-if="
                                                staffParticipants.length === 0
                                            "
                                        >

                                            <td
                                                colspan="7"
                                                class="text-center text-muted"
                                            >
                                                No participants.
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- STAFF PROFILE -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'staff-profile'
                            "
                        >

                            <h2 class="fw-bold">
                                Staff Profile
                            </h2>


                            <div
                                v-if="
                                    staffProfile
                                "
                                class="card dashboard-card mt-4"
                            >

                                <div class="card-body">

                                    <p>

                                        <strong>
                                            Name:
                                        </strong>

                                        {{ staffProfile.name }}

                                    </p>


                                    <p>

                                        <strong>
                                            Email:
                                        </strong>

                                        {{ staffProfile.email }}

                                    </p>


                                    <p>

                                        <strong>
                                            Phone:
                                        </strong>

                                        {{ staffProfile.phone || '-' }}

                                    </p>


                                    <p>

                                        <strong>
                                            Experience:
                                        </strong>

                                        {{ staffProfile.experience || '-' }}

                                    </p>


                                    <p>

                                        <strong>
                                            Specialization:
                                        </strong>

                                        {{ staffProfile.specialization || '-' }}

                                    </p>


                                    <p>

                                        <strong>
                                            Emergency Contact:
                                        </strong>

                                        {{ staffProfile.emergency_contact || '-' }}

                                    </p>


                                    <p>

                                        <strong>
                                            Address:
                                        </strong>

                                        {{ staffProfile.address || '-' }}

                                    </p>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER DASHBOARD -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-dashboard'
                            "
                        >

                            <h2 class="fw-bold">
                                Trekker Dashboard
                            </h2>


                            <p class="text-muted">
                                Welcome {{ currentUser.name }}
                            </p>


                            <div class="row g-3 mt-2">


                                <div class="col-md-3">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h2>
                                                {{ trekkerStats.available_treks }}
                                            </h2>

                                            <span>
                                                Available Treks
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-3">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h2>
                                                {{ trekkerStats.active_bookings }}
                                            </h2>

                                            <span>
                                                Active Bookings
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-3">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h2>
                                                {{ trekkerStats.completed_treks }}
                                            </h2>

                                            <span>
                                                Completed
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-3">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h2>
                                                {{ trekkerStats.cancelled_bookings }}
                                            </h2>

                                            <span>
                                                Cancelled
                                            </span>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <button
                                class="btn btn-primary mt-4"
                                @click="
                                    navigate(
                                        'trekker-treks'
                                    )
                                "
                            >
                                Browse Available Treks
                            </button>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER BROWSE -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-treks'
                            "
                        >

                            <h2 class="fw-bold">
                                Browse Treks
                            </h2>


                            <p class="text-muted">
                                Only Open treks can be booked.
                            </p>


                            <div
                                class="card dashboard-card my-4"
                            >

                                <div class="card-body">

                                    <h5>
                                        Search & Filters
                                    </h5>


                                    <div class="row g-3">


                                        <div class="col-md-3">

                                            <input
                                                v-model="
                                                    trekFilters.search
                                                "
                                                class="form-control"
                                                placeholder="Search trek..."
                                                @keyup.enter="
                                                    loadAvailableTreks
                                                "
                                            >

                                        </div>


                                        <div class="col-md-3">

                                            <select
                                                v-model="
                                                    trekFilters.difficulty
                                                "
                                                class="form-select"
                                            >

                                                <option value="">
                                                    All Difficulties
                                                </option>

                                                <option value="Easy">
                                                    Easy
                                                </option>

                                                <option value="Moderate">
                                                    Moderate
                                                </option>

                                                <option value="Hard">
                                                    Hard
                                                </option>

                                            </select>

                                        </div>


                                        <div class="col-md-3">

                                            <input
                                                v-model="
                                                    trekFilters.location
                                                "
                                                class="form-control"
                                                placeholder="Location"
                                            >

                                        </div>


                                        <div class="col-md-3">

                                            <input
                                                v-model="
                                                    trekFilters.duration
                                                "
                                                type="number"
                                                min="1"
                                                class="form-control"
                                                placeholder="Max duration"
                                            >

                                        </div>


                                        <div class="col-12">

                                            <button
                                                class="btn btn-primary me-2"
                                                @click="
                                                    loadAvailableTreks
                                                "
                                            >
                                                Apply Filters
                                            </button>


                                            <button
                                                class="btn btn-outline-secondary"
                                                @click="
                                                    clearTrekFilters
                                                "
                                            >
                                                Clear
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <div class="row g-4">


                                <div
                                    v-for="
                                        trek in availableTreks
                                    "
                                    :key="trek.id"
                                    class="col-lg-6"
                                >

                                    <div
                                        class="card dashboard-card h-100"
                                    >

                                        <div class="card-body">

                                            <div
                                                class="d-flex justify-content-between"
                                            >

                                                <div>

                                                    <h4>
                                                        {{ trek.name }}
                                                    </h4>

                                                    <p class="text-muted">
                                                        {{ trek.location }}
                                                    </p>

                                                </div>


                                                <span
                                                    class="badge bg-success align-self-start"
                                                >
                                                    {{ trek.status }}
                                                </span>

                                            </div>


                                            <hr>


                                            <p>

                                                <strong>
                                                    Difficulty:
                                                </strong>

                                                {{ trek.difficulty }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Duration:
                                                </strong>

                                                {{ trek.duration }}

                                                days

                                            </p>


                                            <p>

                                                <strong>
                                                    Slots:
                                                </strong>

                                                {{ trek.available_slots }}

                                                /

                                                {{ trek.total_slots }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Start:
                                                </strong>

                                                {{ trek.start_date || '-' }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Staff:
                                                </strong>

                                                {{
                                                    trek.assigned_staff
                                                    ||
                                                    'Not Assigned'
                                                }}

                                            </p>


                                            <button
                                                class="btn btn-outline-primary me-2"
                                                @click="
                                                    viewTrekDetails(
                                                        trek
                                                    )
                                                "
                                            >
                                                View Details
                                            </button>


                                            <button
                                                class="btn btn-success"
                                                :disabled="
                                                    trek.available_slots <= 0
                                                "
                                                @click="
                                                    bookTrek(
                                                        trek
                                                    )
                                                "
                                            >

                                                {{
                                                    trek.available_slots > 0
                                                    ? 'Book Trek'
                                                    : 'Full'
                                                }}

                                            </button>

                                        </div>

                                    </div>

                                </div>


                                <div
                                    v-if="
                                        availableTreks.length === 0
                                    "
                                    class="col-12"
                                >

                                    <div
                                        class="alert alert-info"
                                    >
                                        No matching Open treks found.
                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER TREK DETAILS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-trek-details'
                            "
                        >

                            <button
                                class="btn btn-outline-secondary mb-3"
                                @click="
                                    navigate(
                                        'trekker-treks'
                                    )
                                "
                            >
                                ← Back to Treks
                            </button>


                            <div
                                v-if="
                                    selectedTrek
                                "
                            >

                                <div
                                    class="card dashboard-card"
                                >

                                    <div class="card-body">

                                        <h2>
                                            {{ selectedTrek.name }}
                                        </h2>


                                        <p class="text-muted">
                                            {{ selectedTrek.location }}
                                        </p>


                                        <hr>


                                        <div class="row">


                                            <div class="col-md-6">

                                                <p>

                                                    <strong>
                                                        Difficulty:
                                                    </strong>

                                                    {{ selectedTrek.difficulty }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        Duration:
                                                    </strong>

                                                    {{ selectedTrek.duration }}

                                                    days

                                                </p>


                                                <p>

                                                    <strong>
                                                        Status:
                                                    </strong>

                                                    {{ selectedTrek.status }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        Slots:
                                                    </strong>

                                                    {{ selectedTrek.available_slots }}

                                                    /

                                                    {{ selectedTrek.total_slots }}

                                                </p>

                                            </div>


                                            <div class="col-md-6">

                                                <p>

                                                    <strong>
                                                        Start Date:
                                                    </strong>

                                                    {{ selectedTrek.start_date || '-' }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        End Date:
                                                    </strong>

                                                    {{ selectedTrek.end_date || '-' }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        Staff:
                                                    </strong>

                                                    {{
                                                        selectedTrek.assigned_staff
                                                        ||
                                                        'Not Assigned'
                                                    }}

                                                </p>

                                            </div>

                                        </div>


                                        <h5>
                                            Description
                                        </h5>


                                        <p>

                                            {{
                                                selectedTrek.description
                                                ||
                                                'No description provided.'
                                            }}

                                        </p>


                                        <button
                                            v-if="
                                                selectedTrek.status ===
                                                'Open'
                                            "
                                            class="btn btn-success"
                                            :disabled="
                                                selectedTrek.available_slots <= 0
                                            "
                                            @click="
                                                bookTrek(
                                                    selectedTrek
                                                )
                                            "
                                        >

                                            {{
                                                selectedTrek.available_slots > 0
                                                ? 'Book This Trek'
                                                : 'Trek Full'
                                            }}

                                        </button>

                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER BOOKINGS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-bookings'
                            "
                        >

                            <h2 class="fw-bold">
                                My Bookings
                            </h2>


                            <p class="text-muted">
                                Your active trek bookings.
                            </p>


                            <div class="row g-4 mt-2">


                                <div
                                    v-for="
                                        booking in trekkerBookings
                                    "
                                    :key="booking.id"
                                    class="col-lg-6"
                                >

                                    <div
                                        class="card dashboard-card"
                                    >

                                        <div class="card-body">

                                            <h4>
                                                {{ booking.trek_name }}
                                            </h4>


                                            <p class="text-muted">
                                                {{ booking.location }}
                                            </p>


                                            <p>

                                                <strong>
                                                    Booking ID:
                                                </strong>

                                                #{{ booking.id }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Booking Status:
                                                </strong>

                                                <span
                                                    class="badge bg-success"
                                                >
                                                    {{ booking.booking_status }}
                                                </span>

                                            </p>


                                            <p>

                                                <strong>
                                                    Trek Status:
                                                </strong>

                                                {{ booking.trek_status }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Start:
                                                </strong>

                                                {{ booking.start_date || '-' }}

                                            </p>


                                            <p>

                                                <strong>
                                                    Payment:
                                                </strong>

                                                {{ booking.payment_status }}

                                            </p>


                                            <button
                                                v-if="
                                                    booking.trek_status !==
                                                    'Ongoing'
                                                    &&
                                                    booking.trek_status !==
                                                    'Completed'
                                                "
                                                class="btn btn-danger"
                                                @click="
                                                    cancelBooking(
                                                        booking
                                                    )
                                                "
                                            >
                                                Cancel Booking
                                            </button>


                                            <span
                                                v-else
                                                class="text-muted"
                                            >
                                                Cancellation unavailable.
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div
                                    v-if="
                                        trekkerBookings.length === 0
                                    "
                                    class="col-12"
                                >

                                    <div
                                        class="alert alert-info"
                                    >
                                        No active bookings.
                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER HISTORY -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-history'
                            "
                        >

                            <h2 class="fw-bold">
                                Trekking History
                            </h2>


                            <p class="text-muted">
                                Complete booking history and CSV export.
                            </p>


                            <!-- CSV EXPORT -->

                            <div class="mb-4">


                                <button
                                    class="btn btn-success me-2"
                                    @click="
                                        startHistoryExport
                                    "
                                    :disabled="
                                        exportJob &&
                                        (
                                            exportJob.status ===
                                            'Pending'
                                            ||
                                            exportJob.status ===
                                            'Processing'
                                        )
                                    "
                                >

                                    <span
                                        v-if="
                                            exportJob &&
                                            (
                                                exportJob.status ===
                                                'Pending'
                                                ||
                                                exportJob.status ===
                                                'Processing'
                                            )
                                        "
                                    >
                                        Export Processing...
                                    </span>


                                    <span v-else>
                                        Export History CSV
                                    </span>

                                </button>


                                <button
                                    v-if="
                                        exportJob &&
                                        exportJob.status ===
                                        'Completed'
                                    "
                                    class="btn btn-primary"
                                    @click="
                                        downloadHistoryExport
                                    "
                                >
                                    Download CSV
                                </button>


                                <span
                                    v-if="
                                        exportJob
                                    "
                                    class="ms-3"
                                >

                                    Status:

                                    <strong>
                                        {{ exportJob.status }}
                                    </strong>

                                </span>

                            </div>


                            <div
                                class="table-responsive table-container"
                            >

                                <table
                                    class="table table-hover"
                                >

                                    <thead>

                                        <tr>
                                            <th>Booking</th>
                                            <th>Trek</th>
                                            <th>Location</th>
                                            <th>Booking Date</th>
                                            <th>Booking Status</th>
                                            <th>Trek Status</th>
                                            <th>Payment</th>
                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="
                                                item in trekkerHistory
                                            "
                                            :key="item.id"
                                        >

                                            <td>
                                                #{{ item.id }}
                                            </td>


                                            <td>
                                                {{ item.trek_name }}
                                            </td>


                                            <td>
                                                {{ item.location }}
                                            </td>


                                            <td>
                                                {{ item.booking_date }}
                                            </td>


                                            <td>

                                                <span
                                                    class="badge"
                                                    :class="{
                                                        'bg-success':
                                                            item.booking_status ===
                                                            'Booked',

                                                        'bg-danger':
                                                            item.booking_status ===
                                                            'Cancelled',

                                                        'bg-primary':
                                                            item.booking_status ===
                                                            'Completed'
                                                    }"
                                                >
                                                    {{ item.booking_status }}
                                                </span>

                                            </td>


                                            <td>
                                                {{ item.trek_status }}
                                            </td>


                                            <td>
                                                {{ item.payment_status }}
                                            </td>

                                        </tr>


                                        <tr
                                            v-if="
                                                trekkerHistory.length === 0
                                            "
                                        >

                                            <td
                                                colspan="7"
                                                class="text-center text-muted"
                                            >
                                                No booking history.
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER PROFILE -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-profile'
                            "
                        >

                            <h2 class="fw-bold">
                                My Profile
                            </h2>


                            <div
                                v-if="
                                    trekkerProfile
                                "
                                class="card dashboard-card mt-4"
                            >

                                <div class="card-body">

                                    <div class="row g-3">


                                        <div class="col-md-6">

                                            <label class="form-label">
                                                Name
                                            </label>

                                            <input
                                                v-model="
                                                    trekkerProfileForm.name
                                                "
                                                class="form-control"
                                            >

                                        </div>


                                        <div class="col-md-6">

                                            <label class="form-label">
                                                Phone
                                            </label>

                                            <input
                                                v-model="
                                                    trekkerProfileForm.phone
                                                "
                                                class="form-control"
                                            >

                                        </div>


                                        <div class="col-md-6">

                                            <label class="form-label">
                                                Email
                                            </label>

                                            <input
                                                :value="
                                                    trekkerProfile.email
                                                "
                                                class="form-control"
                                                disabled
                                            >

                                        </div>


                                        <div class="col-md-6">

                                            <label class="form-label">
                                                Role
                                            </label>

                                            <input
                                                :value="
                                                    trekkerProfile.role
                                                "
                                                class="form-control"
                                                disabled
                                            >

                                        </div>


                                        <div class="col-12">

                                            <button
                                                class="btn btn-primary"
                                                @click="
                                                    updateTrekkerProfile
                                                "
                                            >
                                                Save Profile
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER NOTIFICATIONS -->
                        <!-- ============================================= -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-notifications'
                            "
                        >

                            <h2 class="fw-bold">
                                Notifications
                            </h2>


                            <p class="text-muted">
                                Trek reminders and background job updates.
                            </p>


                            <div
                                v-for="
                                    notification
                                    in notifications
                                "
                                :key="
                                    notification.id
                                "
                                class="card dashboard-card mb-3"
                                :class="{
                                    'border-primary':
                                        !notification.is_read
                                }"
                            >

                                <div class="card-body">


                                    <div
                                        class="d-flex justify-content-between align-items-start"
                                    >

                                        <h5>
                                            {{ notification.title }}
                                        </h5>


                                        <span
                                            class="badge bg-secondary"
                                        >
                                            {{ notification.notification_type }}
                                        </span>

                                    </div>


                                    <p class="mb-2">
                                        {{ notification.message }}
                                    </p>


                                    <small class="text-muted">
                                        {{ notification.created_at }}
                                    </small>


                                    <div
                                        v-if="
                                            !notification.is_read
                                        "
                                        class="mt-3"
                                    >

                                        <button
                                            class="btn btn-sm btn-outline-primary"
                                            @click="
                                                markNotificationRead(
                                                    notification
                                                )
                                            "
                                        >
                                            Mark as Read
                                        </button>

                                    </div>


                                    <div
                                        v-else
                                        class="mt-3"
                                    >

                                        <span
                                            class="badge bg-success"
                                        >
                                            Read
                                        </span>

                                    </div>

                                </div>

                            </div>


                            <div
                                v-if="
                                    notifications.length === 0
                                "
                                class="alert alert-info"
                            >
                                No notifications yet.
                            </div>

                        </div>


                    </main>

                </div>

            </div>

        </div>

    </div>

    `

}).mount("#app");