package com.example.contacts.ui;

import com.example.base.ui.ViewTitle;
import com.vaadin.flow.component.button.Button;
import com.vaadin.flow.component.button.ButtonVariant;
import com.vaadin.flow.component.combobox.ComboBox;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.notification.Notification;
import com.vaadin.flow.component.notification.NotificationVariant;
import com.vaadin.flow.component.orderedlayout.HorizontalLayout;
import com.vaadin.flow.component.orderedlayout.VerticalLayout;
import com.vaadin.flow.component.textfield.EmailField;
import com.vaadin.flow.component.textfield.TextField;
import com.vaadin.flow.router.Menu;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.Route;

@Route("contact")
@PageTitle("New Contact")
@Menu(order = 1, icon = "icons/user-round.svg", title = "New Contact")
class ContactView extends VerticalLayout {

    ContactView() {
        var firstName = new TextField("First name");
        var lastName = new TextField("Last name");
        var email = new EmailField("Email");
        var phone = new TextField("Phone");
        var birthday = new DatePicker("Birthday");
        var country = new ComboBox<String>("Country");
        country.setItems("Finland", "Germany", "Sweden", "United Kingdom", "United States");

        var form = new FormLayout();
        form.add(firstName, lastName, email, phone, birthday, country);
        form.setMaxWidth("40em");

        var save = new Button("Save", event -> Notification.show("Contact saved", 3000, Notification.Position.BOTTOM_END)
                .addThemeVariants(NotificationVariant.SUCCESS));
        save.addThemeVariants(ButtonVariant.PRIMARY);
        var cancel = new Button("Cancel");

        var buttons = new HorizontalLayout();
        buttons.add(save, cancel);

        add(new ViewTitle("New Contact"), form, buttons);
    }
}
