import "./AuthForm.css"
import { useState } from "react";

export default function AuthForm() {
    // Store values entered in the form
    const [ formData, setFormData ] = useState({
        email: "",
        password: "",
        rememberMe: false,
    });

    // Control if password is visible text or not
    const [ showPassword, setShowPassword ] = useState(false);

    // Store validation messages for each field
    const [ errors, setErrors ] = useState({})

    // Track if sign in request is being loading
    const [ isLoading, setIsLoading ] = useState(false)

    // Update the field if the user is changing an input
    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setFormData((previousData) => ({
            ...previousData,
            [name]: type === "checkbox" ? checked : value,
        }));

        // Clear the field error once the user begins to correct it
        setErrors((previousErrors) => ({
            ...previousErrors,
            [name]: "",
        }));
    }

    // Check the form values and return any errors
    const validateForm = () => {
        const newErrors = {}

        // Require the correct format for the email
        if (!formData.email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Enter a valid email address"
        }

        // Require a password 
        if (!formData.password) {
            newErrors.password = "Password is required"
        } 

        return newErrors;
    }

    const handleSubmit = (event) => {
        event.preventDefault()

        const validationErrors = validateForm()
        setErrors(validationErrors)

        // Stop submission when there is a validation error
        if (Object.keys(validationErrors).length > 0){
            return
        }

        // Simulate time needed to process sign in
        setIsLoading(true)

        setTimeout(() => {
            setIsLoading(false)

            // Temp confirmation (changed w/ backend integration)
            console.log("Valid sign-in form:", formData)
        }, 1000)
    }

    // Authentication form structure
    return (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Show title and instructions for the form */}
            <div className="auth-heading">
                <h1>Welcome back!</h1>
                <p>Sign in to your account</p>
            </div>

            {/* Get the user's email */}
            <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    aria-invalid={Boolean(errors.email)}
                />

                {/* Display error */}
                {errors.email && (
                    <p className="form-error" role="alert">
                        {errors.email}
                    </p>
                )}
            </div>

            {/* Get the user's password */}
            <div className="form-group">
                <label htmlFor="password">Password</label>

                <div className="password-input-wrapper">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleChange}
                        aria-invalid={Boolean(errors.password)}
                    />

                    {/* Button to allow to show or hide password */}
                    <button
                        className="password-toggle"
                        type="button"
                        onClick={() => setShowPassword((currentValue) => !currentValue)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? "Hide" : "Show"}
                    </button>
                </div>

                {/* Display error */}
                {errors.password && (
                    <p className="form-error" role="alert">
                        {errors.password}
                    </p>
                )}

            </div>

            {/* Additional options */}
            <div className="form-options">
                <label className="remember-me">
                    <input 
                        name="rememberMe" 
                        type="checkbox" 
                        checked={formData.rememberMe}
                        onChange={handleChange}
                    />
                    <span>Remember me</span>
                </label>

                <button className="forgot-password" type="button">
                    Forgot password?
                </button>
            </div>

            {/* Submit form */}
            <button 
                className="sign-in-button" 
                type="submit"
                disabled={isLoading}    
            >
                {isLoading ? "Signing in..." : "Sign in"}
            </button>

            {/* Direct users to an admin if they don't have an account */}
            <p className="admin-message">
                Don&apos;t have an account?{" "}
                <button type="button">Contact your admin</button>
            </p>
        </form>
    );
}