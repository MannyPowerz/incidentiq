import "./AuthForm.css"
import { useState } from "react";

export default function AuthForm() {
    // Store values entered in the form
    const [ formData, setFormData ] = useState({
        email: "",
        password: "",
        rememberMe: false,
    });

    // Update the field is the user is changing an input
    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setFormData((previousData) => ({
            ...previousData,
            [name]: type === "checkbox" ? checked : value,
        }));
    }

    // Authentication form structure
    return (
        <form className="auth-form">
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
                />
            </div>

            {/* Get the users password */}
            <div className="form-group">
                <label htmlFor="password">Password</label>

                <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter you password"
                    value={formData.password}
                    onChange={handleChange}
                />
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
            <button className="sign-in-button" type="submit">
                Sign in
            </button>

            {/* Direct users to an admin if they don't have an account */}
            <p className="admin-message">
                Don't have an account?
                <button type="button">Contact your admin</button>
            </p>
        </form>
    );
}