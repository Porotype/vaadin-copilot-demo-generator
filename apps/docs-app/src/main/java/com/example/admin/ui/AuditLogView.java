package com.example.admin.ui;

import com.example.base.ui.ViewTitle;
import com.vaadin.flow.component.html.Paragraph;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.router.Menu;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;
import jakarta.annotation.security.RolesAllowed;

@Route(value = "audit-log", registerAtStartup = false)
@PageTitle("Audit Log")
@Menu(order = 3, icon = "vaadin:records", title = "Audit Log")
@RolesAllowed("ADMIN")
public class AuditLogView extends VerticalLayout {

    public AuditLogView() {
        add(new ViewTitle("Audit Log"), new Paragraph("No events yet."));
    }
}
