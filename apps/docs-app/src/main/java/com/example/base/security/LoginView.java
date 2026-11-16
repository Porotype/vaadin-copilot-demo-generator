package com.example.base.security;

import com.vaadin.flow.component.html.Main;
import com.vaadin.flow.component.login.LoginForm;
import com.vaadin.flow.component.orderedlayout.FlexComponent;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.BeforeEnterEvent;
import com.vaadin.flow.router.BeforeEnterObserver;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import com.vaadin.flow.spring.security.AuthenticationContext;

@Route(value = "login", autoLayout = false, registerAtStartup = false)
@PageTitle("Login")
public class LoginView extends Main implements BeforeEnterObserver {

    private final AuthenticationContext authenticationContext;
    private final LoginForm login;

    public LoginView(AuthenticationContext authenticationContext) {
        this.authenticationContext = authenticationContext;
        login = new LoginForm();
        login.setAction("login");

        var layout = new VerticalLayout(login);
        layout.setAlignItems(FlexComponent.Alignment.CENTER);
        layout.setJustifyContentMode(FlexComponent.JustifyContentMode.CENTER);
        layout.setSizeFull();

        add(layout);
        setSizeFull();
    }

    @Override
    public void beforeEnter(BeforeEnterEvent event) {
        // Already signed in, such as after switching users with Copilot: go to the application.
        if (authenticationContext.isAuthenticated()) {
            event.forwardTo("");
            return;
        }
        if (event.getLocation().getQueryParameters().getParameters().containsKey("error")) {
            login.setError(true);
        }
    }
}
