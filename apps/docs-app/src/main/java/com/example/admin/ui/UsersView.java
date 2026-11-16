package com.example.admin.ui;

import com.example.base.ui.ViewTitle;
import com.vaadin.flow.component.grid.Grid;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.Menu;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import jakarta.annotation.security.RolesAllowed;

@Route(value = "users", registerAtStartup = false)
@PageTitle("Users")
@Menu(order = 2, icon = "vaadin:users", title = "Users")
@RolesAllowed("ADMIN")
public class UsersView extends VerticalLayout {

    record Account(String username, String roles) {
    }

    public UsersView() {
        var grid = new Grid<Account>();
        grid.addColumn(Account::username).setHeader("Username");
        grid.addColumn(Account::roles).setHeader("Roles");
        grid.setItems(new Account("admin", "Admin, User"), new Account("user", "User"));
        grid.setAllRowsVisible(true);
        add(new ViewTitle("Users"), grid);
    }
}
