import { useState } from "react";
import type { JSX } from "react";
import type * as React from "react"
import { useNavigate } from "react-router-dom";
import { login, register, ApiError } from "../../auth/api";
import { Button, Input } from "../ui";
import "./AuthForm.css"

type AuthFormData = {
    email: string;
    password: string;
    rememberMe: boolean;
};

type AuthFormErrors = {
    email?: string;
    password?: string;
}

// one form, two endpoints: a toggle rather than a /register route, since the redesign will redo this screen anyway
type AuthMode = "signin" | "register";

// mirrors credentialsSchema in server/src/auth/routes/index.ts — the server is the source of truth,
// this just spares the user a 400 whose body is a raw ZodError rather than a readable message
const PASSWORD_MIN_LENGTH = 8;


export default function AuthForm() : JSX.Element {
    // Store values entered in the form
    const [ formData, setFormData ] = useState<AuthFormData>({
        email: "",
        password: "",
        rememberMe: false,
    });

    // Control if password is visible text or not
    const [ showPassword, setShowPassword ] = useState<boolean>(false);

    // Store validation messages for each field
    const [ errors, setErrors ] = useState<AuthFormErrors>({})

    // Track if sign in request is being loading
    const [ isLoading, setIsLoading ] = useState<boolean>(false)

    const [ mode, setMode ] = useState<AuthMode>("signin")

    // errors above are per-field; invalid_credentials / email_taken belong to the whole submission
    const [ submitError, setSubmitError ] = useState<string | null>(null)

    const navigate = useNavigate()

    // Update the field if the user is changing an input
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
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
        setSubmitError(null)
    }

    // Check the form values and return any errors
    const validateForm = () : AuthFormErrors => {
        const newErrors: AuthFormErrors = {}

        // Require the correct format for the email
        if (!formData.email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Enter a valid email address"
        }

        // Require a password
        if (!formData.password) {
            newErrors.password = "Password is required"
        } else if (formData.password.length < PASSWORD_MIN_LENGTH) {
            newErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        }

        return newErrors;
    }

    const handleSubmit = async (event : React.FormEvent<HTMLFormElement>) : Promise<void> => {
        event.preventDefault()

        const validationErrors = validateForm()
        setErrors(validationErrors)

        // Stop submission when there is a validation error
        if (Object.keys(validationErrors).length > 0){
            return
        }

        setIsLoading(true)
        setSubmitError(null)

        try {
            // both calls write the token store on success (api.ts), so there's nothing to keep here
            const submit = mode === "signin" ? login : register
            await submit(formData.email, formData.password)

            // replace: the sign-in page shouldn't be one Back-press away once you're in
            navigate("/rooms", { replace: true })
        } catch (err) {
            // ApiError carries the server's own message (invalid_credentials, email_taken); anything else is the network
            setSubmitError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.")
            setIsLoading(false)
        }
    }

    const toggleMode = (): void => {
        setMode((current) => (current === "signin" ? "register" : "signin"))
        setSubmitError(null)
    }

    // Authentication form structure — markup rebuilt on the ui primitives; every handler above is unchanged from #34
    return (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-form__heading">
                <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
                <p>{mode === "signin" ? "Sign in to your war room." : "You'll join the Demo Team for now."}</p>
            </div>

            <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
            />

            {/* new-password on register so password managers offer to generate one instead of autofilling */}
            <Input
                label="Password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signin" ? "Your password" : `At least ${PASSWORD_MIN_LENGTH} characters`}
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                trailing={
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword((currentValue) => !currentValue)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                    >
                        {showPassword ? "Hide" : "Show"}
                    </Button>
                }
            />

            {/* TODO: decision — rememberMe is sent nowhere. The refresh cookie already keeps you signed in across
                reloads (REFRESH_TOKEN_TTL_MS, server), so this either drives a shorter/longer cookie TTL server-side
                or gets removed. "Forgot password?" has no handler and no endpoint behind it either.
                Both kept so this item changes the look only, not behavior. */}
            <div className="auth-form__options">
                <label className="auth-form__remember">
                    <input
                        name="rememberMe"
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={handleChange}
                    />
                    <span>Remember me</span>
                </label>

                <button className="auth-form__link" type="button">
                    Forgot password?
                </button>
            </div>

            {/* Whole-submission error: wrong password, taken email, server unreachable */}
            {submitError && (
                <p className="auth-form__error" role="alert">
                    {submitError}
                </p>
            )}

            <Button type="submit" loading={isLoading} className="auth-form__submit">
                {mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            {/* Flip between the two endpoints without leaving the page */}
            <p className="auth-form__switch">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button className="auth-form__link" type="button" onClick={toggleMode}>
                    {mode === "signin" ? "Create one" : "Sign in"}
                </button>
            </p>
        </form>
    );
}