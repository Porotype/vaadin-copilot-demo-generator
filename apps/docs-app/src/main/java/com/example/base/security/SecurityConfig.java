package com.example.base.security;

import com.example.admin.ui.AuditLogView;
import com.example.admin.ui.UsersView;
import com.vaadin.flow.router.RouteConfiguration;
import com.vaadin.flow.server.VaadinServiceInitListener;
import com.vaadin.flow.server.auth.AccessAnnotationChecker;
import com.vaadin.flow.server.auth.AnonymousAllowed;
import com.vaadin.flow.server.startup.ApplicationRouteRegistry;
import com.vaadin.flow.spring.security.VaadinSecurityConfigurer;
import jakarta.annotation.security.DenyAll;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import java.security.Principal;
import java.util.function.Function;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.provisioning.UserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The login, for the secure profile only (the impersonation walkthrough). Without it, the app has no Spring Security
 * at all (see application.properties), so the other walkthroughs record an app without a login, and Copilot offers
 * no impersonation.
 */
@Profile("secure")
@EnableWebSecurity
@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // The side nav's icons are static files of the application's own.
        http.authorizeHttpRequests(auth -> auth.requestMatchers("/icons/**").permitAll());
        http.with(VaadinSecurityConfigurer.vaadin(), configurer -> configurer.loginView(LoginView.class));
        return http.build();
    }

    @Bean
    UserDetailsManager userDetailsManager() {
        LoggerFactory.getLogger(SecurityConfig.class).warn("NOT FOR PRODUCTION: Using in-memory user details manager!");
        var user = User.withUsername("user").password("{noop}user").roles("USER").build();
        var admin = User.withUsername("admin").password("{noop}admin").roles("USER", "ADMIN").build();
        return new InMemoryUserDetailsManager(user, admin);
    }

    /**
     * Views and layouts without an access annotation are open to any signed-in user, as if they had
     * {@code @PermitAll}: the shared views stay as start.vaadin.com wrote them.
     */
    @Bean
    AccessAnnotationChecker accessAnnotationChecker() {
        return new AccessAnnotationChecker() {
            @Override
            public boolean hasAccess(Class<?> cls, Principal principal, Function<String, Boolean> roleChecker) {
                var annotated = cls.isAnnotationPresent(AnonymousAllowed.class) || cls.isAnnotationPresent(PermitAll.class)
                        || cls.isAnnotationPresent(RolesAllowed.class) || cls.isAnnotationPresent(DenyAll.class);
                return annotated ? super.hasAccess(cls, principal, roleChecker) : principal != null;
            }
        };
    }

    /** The login and the admin views exist only in this profile. */
    @Bean
    VaadinServiceInitListener secureRoutes() {
        return event -> {
            var routes = RouteConfiguration.forRegistry(ApplicationRouteRegistry.getInstance(event.getSource().getContext()));
            routes.setAnnotatedRoute(LoginView.class);
            routes.setAnnotatedRoute(UsersView.class);
            routes.setAnnotatedRoute(AuditLogView.class);
        };
    }
}
