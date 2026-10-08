const { createApp } = Vue;

createApp({

    data() {
        return {

            // =================================================
            // COMMON APP STATE
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
            // TREKKER REGISTER
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

            staffStatusForm: {
                status: "Open"
            },


            // =================================================
            // STAFF PARTICIPANTS
            // =================================================

            staffParticipants: [],


            // =================================================
            // STAFF PROFILE
            // =================================================

            staffProfile: null
        };
    },


    // =========================================================
    // APPLICATION START
    // =========================================================

    async mounted() {

        if (this.token) {

            await this.loadCurrentUser();

        }
        else {

            this.currentPage = "login";
        }
    },


    methods: {

        // =====================================================
        // CLEAR ALERT MESSAGES
        // =====================================================

        clearMessages() {

            this.errorMessage = "";

            this.successMessage = "";
        },


        // =====================================================
        // COMMON API REQUEST
        // =====================================================

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

            }
            catch (error) {

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        // =====================================================
        // TREKKER REGISTRATION
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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        // =====================================================
        // CURRENT USER
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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ROLE REDIRECT
        // =====================================================

        async redirectByRole() {

            if (!this.currentUser) {

                this.currentPage =
                    "login";

                return;
            }


            if (
                this.currentUser.role === "Admin"
            ) {

                this.currentPage =
                    "admin-dashboard";

                await this.loadAdminDashboard();
            }


            else if (
                this.currentUser.role === "Staff"
            ) {

                this.currentPage =
                    "staff-dashboard";

                await this.loadStaffDashboard();
            }


            else if (
                this.currentUser.role === "Trekker"
            ) {

                this.currentPage =
                    "trekker-dashboard";
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

            }
            catch (error) {

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


            this.clearMessages();
        },


        // =====================================================
        // PAGE NAVIGATION
        // =====================================================

        async navigate(page) {

            this.clearMessages();

            this.currentPage = page;


            // ADMIN

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


            // STAFF

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN LOAD TREKS
        // =====================================================

        async loadTreks() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/treks"
                    );


                this.treks =
                    data.treks;

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // RESET TREK FORM
        // =====================================================

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


        // =====================================================
        // CREATE / UPDATE TREK
        // =====================================================

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


            this.loading = true;


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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        // =====================================================
        // EDIT TREK
        // =====================================================

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


        // =====================================================
        // DELETE TREK
        // =====================================================

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN LOAD STAFF
        // =====================================================

        async loadStaff() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/staff"
                    );


                this.staff =
                    data.staff;

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN CREATE STAFF
        // =====================================================

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN ASSIGN STAFF
        // =====================================================

        async assignStaff() {

            this.clearMessages();


            if (
                !this.assignForm.trek_id ||
                !this.assignForm.staff_id
            ) {

                this.errorMessage =
                    "Select both trek and staff member.";

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


                await this.loadTreks();

                await this.loadStaff();

            }
            catch (error) {

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // USER BLACKLIST
        // =====================================================

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ACTIVATE / DEACTIVATE USER
        // =====================================================

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

            }
            catch (error) {

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ADMIN SEARCH
        // =====================================================

        async performSearch() {

            this.clearMessages();


            if (!this.searchQuery.trim()) {

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

            }
            catch (error) {

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

            }
            catch (error) {

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // SELECT STAFF TREK
        // =====================================================

        selectStaffTrek(trek) {

            this.clearMessages();


            this.selectedStaffTrek = {
                ...trek
            };


            this.staffSlotForm.total_slots =
                trek.total_slots;


            this.staffStatusForm.status =
                trek.status;


            this.currentPage =
                "staff-manage-trek";


            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        },


        // =====================================================
        // STAFF UPDATE SLOTS
        // =====================================================

        async updateStaffSlots() {

            this.clearMessages();


            if (!this.selectedStaffTrek) {

                return;
            }


            const totalSlots =
                Number(
                    this.staffSlotForm.total_slots
                );


            if (totalSlots <= 0) {

                this.errorMessage =
                    "Total slots must be greater than 0.";

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
                                        totalSlots
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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // STAFF UPDATE STATUS
        // =====================================================

        async updateStaffStatus(status) {

            this.clearMessages();


            if (!this.selectedStaffTrek) {

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
                                    status: status
                                })
                        }
                    );


                this.successMessage =
                    data.message;


                this.selectedStaffTrek.status =
                    status;


                this.staffStatusForm.status =
                    status;


                await this.loadStaffTreks();

                await this.loadStaffDashboard();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ALL STAFF PARTICIPANTS
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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // ONE TREK PARTICIPANTS
        // =====================================================

        async viewTrekParticipants(trek) {

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

            }
            catch (error) {

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

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        }
    },


    // =========================================================
    // HTML TEMPLATE
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


                    <form @submit.prevent="login">


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
                            type="submit"
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
            v-else-if="currentPage === 'register'"
            class="auth-container"
        >

            <div class="card auth-card">

                <div class="card-body p-4">

                    <h2 class="fw-bold text-center">
                        Trekker Registration
                    </h2>


                    <p class="text-muted text-center">
                        Create a Trekker account
                    </p>


                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <form @submit.prevent="register">

                        <input
                            v-model.trim="registerForm.name"
                            class="form-control mb-3"
                            placeholder="Full Name"
                        >


                        <input
                            v-model.trim="registerForm.email"
                            class="form-control mb-3"
                            type="email"
                            placeholder="Email"
                        >


                        <input
                            v-model.trim="registerForm.phone"
                            class="form-control mb-3"
                            placeholder="Phone"
                        >


                        <input
                            v-model="registerForm.password"
                            class="form-control mb-3"
                            type="password"
                            placeholder="Password"
                        >


                        <input
                            v-model="registerForm.confirmPassword"
                            class="form-control mb-3"
                            type="password"
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
        <!-- LOGGED IN APP -->
        <!-- ================================================= -->

        <div v-else class="app-container">


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
                            class="nav-link active text-start"
                        >
                            Dashboard
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
                                        @submit.prevent="saveTrek"
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
                                                    @click="resetTrekForm"
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
                                            v-for="trek in treks"
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
                                                        editTrek(trek)
                                                    "
                                                >
                                                    Edit
                                                </button>


                                                <button
                                                    class="btn btn-danger btn-sm"
                                                    @click="
                                                        deleteTrek(trek)
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


                            <div class="row g-4 my-3">


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
                                                    v-for="trek in treks"
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
                                                @click="assignStaff"
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

                                            <th>Phone</th>

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
                                                    person.phone
                                                    ||
                                                    '-'
                                                }}
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

                                <table
                                    class="table table-hover"
                                >

                                    <thead>

                                        <tr>

                                            <th>ID</th>

                                            <th>Name</th>

                                            <th>Role</th>

                                            <th>Email</th>

                                            <th>Active</th>

                                            <th>Blacklist</th>

                                            <th>Actions</th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="user in users"
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
                                    v-model.trim="searchQuery"
                                    @keyup.enter="performSearch"
                                    class="form-control"
                                    placeholder="Search trek, user or staff..."
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
                                :key="'t'+trek.id"
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
                                :key="'u'+user.id"
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
                                :key="'s'+person.id"
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

                            <h2 class="fw-bold mb-1">
                                Trek Staff Dashboard
                            </h2>


                            <p class="text-muted mb-4">
                                Manage your assigned trekking routes.
                            </p>


                            <div class="row g-3">


                                <div class="col-md-4 col-lg">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.assigned_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Assigned Treks
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.open_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Open
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.ongoing_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Ongoing
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.completed_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Completed
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4 col-lg">

                                    <div class="card dashboard-card">

                                        <div class="card-body text-center">

                                            <h3>
                                                {{ staffStats.total_participants }}
                                            </h3>

                                            <span class="text-muted">
                                                Participants
                                            </span>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <div class="mt-4">

                                <button
                                    class="btn btn-primary"
                                    @click="
                                        navigate(
                                            'staff-treks'
                                        )
                                    "
                                >
                                    View My Treks
                                </button>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- STAFF MY TREKS -->
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


                            <p class="text-muted">
                                Only treks assigned to you are shown here.
                            </p>


                            <div class="row g-4 mt-2">


                                <div
                                    v-for="
                                        trek in staffTreks
                                    "
                                    :key="trek.id"
                                    class="col-lg-6"
                                >

                                    <div class="card trek-card">

                                        <div class="card-body">


                                            <div
                                                class="d-flex justify-content-between align-items-start"
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
                                                    class="badge bg-secondary"
                                                >
                                                    {{ trek.status }}
                                                </span>

                                            </div>


                                            <hr>


                                            <div class="row">


                                                <div class="col-6">

                                                    <strong>
                                                        Difficulty
                                                    </strong>

                                                    <p>
                                                        {{ trek.difficulty }}
                                                    </p>

                                                </div>


                                                <div class="col-6">

                                                    <strong>
                                                        Duration
                                                    </strong>

                                                    <p>
                                                        {{ trek.duration }}
                                                        days
                                                    </p>

                                                </div>


                                                <div class="col-6">

                                                    <strong>
                                                        Slots
                                                    </strong>

                                                    <p>
                                                        {{ trek.available_slots }}
                                                        /
                                                        {{ trek.total_slots }}
                                                    </p>

                                                </div>


                                                <div class="col-6">

                                                    <strong>
                                                        Participants
                                                    </strong>

                                                    <p>
                                                        {{ trek.participant_count }}
                                                    </p>

                                                </div>

                                            </div>


                                            <p
                                                v-if="
                                                    trek.start_date
                                                "
                                            >

                                                <strong>
                                                    Dates:
                                                </strong>

                                                {{ trek.start_date }}

                                                <span
                                                    v-if="
                                                        trek.end_date
                                                    "
                                                >
                                                    to
                                                    {{ trek.end_date }}
                                                </span>

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
                                        No treks have been assigned to you.
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
                                ← Back to My Treks
                            </button>


                            <div
                                v-if="
                                    selectedStaffTrek
                                "
                            >

                                <h2 class="fw-bold">
                                    Manage Trek
                                </h2>


                                <p class="text-muted">

                                    {{ selectedStaffTrek.name }}

                                    —

                                    {{ selectedStaffTrek.location }}

                                </p>


                                <div class="row g-4">


                                    <div class="col-lg-6">

                                        <div class="card dashboard-card">

                                            <div class="card-body">

                                                <h5>
                                                    Trek Information
                                                </h5>

                                                <hr>


                                                <p>

                                                    <strong>
                                                        ID:
                                                    </strong>

                                                    {{ selectedStaffTrek.id }}

                                                </p>


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

                                                    <span
                                                        class="badge bg-primary"
                                                    >
                                                        {{ selectedStaffTrek.status }}
                                                    </span>

                                                </p>


                                                <p>

                                                    <strong>
                                                        Available Slots:
                                                    </strong>

                                                    {{ selectedStaffTrek.available_slots }}

                                                    /

                                                    {{ selectedStaffTrek.total_slots }}

                                                </p>


                                                <p>

                                                    <strong>
                                                        Participants:
                                                    </strong>

                                                    {{ selectedStaffTrek.participant_count }}

                                                </p>

                                            </div>

                                        </div>

                                    </div>



                                    <div class="col-lg-6">


                                        <div
                                            class="card dashboard-card mb-4"
                                        >

                                            <div class="card-body">

                                                <h5>
                                                    Update Trek Slots
                                                </h5>


                                                <label
                                                    class="form-label mt-2"
                                                >
                                                    Total Slots
                                                </label>


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


                                                <div
                                                    class="d-flex flex-wrap gap-2 mt-3"
                                                >

                                                    <button
                                                        class="btn btn-success"
                                                        @click="
                                                            updateStaffStatus(
                                                                'Open'
                                                            )
                                                        "
                                                    >
                                                        Open
                                                    </button>


                                                    <button
                                                        class="btn btn-secondary"
                                                        @click="
                                                            updateStaffStatus(
                                                                'Closed'
                                                            )
                                                        "
                                                    >
                                                        Close
                                                    </button>


                                                    <button
                                                        class="btn btn-warning"
                                                        @click="
                                                            updateStaffStatus(
                                                                'Ongoing'
                                                            )
                                                        "
                                                    >
                                                        Start / Ongoing
                                                    </button>


                                                    <button
                                                        class="btn btn-primary"
                                                        @click="
                                                            updateStaffStatus(
                                                                'Completed'
                                                            )
                                                        "
                                                    >
                                                        Complete
                                                    </button>

                                                </div>


                                                <div
                                                    class="alert alert-warning mt-3 mb-0"
                                                >
                                                    Completing a trek will mark active
                                                    bookings as completed.
                                                </div>

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
                                Trek Participants
                            </h2>


                            <p class="text-muted">

                                {{
                                    selectedStaffTrek
                                    ? 'Participants for ' +
                                      selectedStaffTrek.name
                                    : 'Participants registered for your assigned treks.'
                                }}

                            </p>


                            <div
                                class="table-responsive table-container mt-4"
                            >

                                <table
                                    class="table table-hover align-middle"
                                >

                                    <thead>

                                        <tr>

                                            <th>
                                                Booking
                                            </th>

                                            <th>
                                                Participant
                                            </th>

                                            <th>
                                                Email
                                            </th>

                                            <th>
                                                Phone
                                            </th>

                                            <th>
                                                Trek
                                            </th>

                                            <th>
                                                Booking Status
                                            </th>

                                            <th>
                                                Payment
                                            </th>

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

                                                <span
                                                    class="badge bg-secondary"
                                                >
                                                    {{
                                                        participant.booking_status
                                                    }}
                                                </span>

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
                                                class="text-center text-muted py-4"
                                            >
                                                No participant records found.
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
                                My Profile
                            </h2>


                            <div
                                v-if="
                                    staffProfile
                                "
                                class="card dashboard-card mt-4"
                            >

                                <div class="card-body">

                                    <div class="row g-4">


                                        <div class="col-md-6">

                                            <label class="text-muted">
                                                Name
                                            </label>

                                            <h5>
                                                {{ staffProfile.name }}
                                            </h5>

                                        </div>


                                        <div class="col-md-6">

                                            <label class="text-muted">
                                                Email
                                            </label>

                                            <h5>
                                                {{ staffProfile.email }}
                                            </h5>

                                        </div>


                                        <div class="col-md-6">

                                            <label class="text-muted">
                                                Phone
                                            </label>

                                            <h5>
                                                {{
                                                    staffProfile.phone
                                                    ||
                                                    '-'
                                                }}
                                            </h5>

                                        </div>


                                        <div class="col-md-6">

                                            <label class="text-muted">
                                                Experience
                                            </label>

                                            <h5>
                                                {{
                                                    staffProfile.experience
                                                    ||
                                                    '-'
                                                }}
                                            </h5>

                                        </div>


                                        <div class="col-md-6">

                                            <label class="text-muted">
                                                Specialization
                                            </label>

                                            <h5>
                                                {{
                                                    staffProfile.specialization
                                                    ||
                                                    '-'
                                                }}
                                            </h5>

                                        </div>


                                        <div class="col-md-6">

                                            <label class="text-muted">
                                                Emergency Contact
                                            </label>

                                            <h5>
                                                {{
                                                    staffProfile.emergency_contact
                                                    ||
                                                    '-'
                                                }}
                                            </h5>

                                        </div>


                                        <div class="col-12">

                                            <label class="text-muted">
                                                Address
                                            </label>

                                            <h5>
                                                {{
                                                    staffProfile.address
                                                    ||
                                                    '-'
                                                }}
                                            </h5>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>



                        <!-- ============================================= -->
                        <!-- TREKKER PLACEHOLDER -->
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
                                Trek booking features will be added next.
                            </p>

                        </div>


                    </main>

                </div>

            </div>

        </div>

    </div>
    `

}).mount("#app");