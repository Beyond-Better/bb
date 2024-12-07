#!/bin/bash

PROJECTS_FILE="$HOME/.config/bb/bb-projects.txt"
LAST_PROJECT_FILE="$HOME/.config/bb/last-project.txt"
BB_EXECUTABLE="/usr/local/bin/bb"

mkdir -p "$(dirname "$PROJECTS_FILE")"
touch "$PROJECTS_FILE"
touch "$LAST_PROJECT_FILE"

function list_projects() {
    echo "Current BB Projects:"
    echo "===================="
    if [ -s "$PROJECTS_FILE" ]; then
        cat -n "$PROJECTS_FILE"
    else
        echo "No projects configured."
    fi
    echo
}

function add_project() {
    read -p "Enter the full path of the new project directory: " new_project
    if [ -d "$new_project" ]; then
        echo "$new_project" >> "$PROJECTS_FILE"
        echo "Project added successfully."
    else
        echo "Directory does not exist. Please enter a valid path."
    fi
}

function remove_project() {
    if [ ! -s "$PROJECTS_FILE" ]; then
        echo "No projects configured. Please add a project first."
        return
    fi

    list_projects
    read -p "Enter the number of the project to remove: " remove_number
    sed -i "${remove_number}d" "$PROJECTS_FILE"
    echo "Project removed successfully."
}

function run_command() {
    if [ ! -s "$PROJECTS_FILE" ]; then
        echo "No projects configured. Please add a project first."
        return
    fi

    project_count=$(wc -l < "$PROJECTS_FILE")

    if [ "$project_count" -eq 1 ]; then
        selected_project=$(cat "$PROJECTS_FILE")
    else
        list_projects
        last_project=$(cat "$LAST_PROJECT_FILE")
        read -p "Enter project number (or press Enter for last used project): " project_choice

        if [ -z "$project_choice" ] && [ -n "$last_project" ]; then
            selected_project="$last_project"
        else
            selected_project=$(sed "${project_choice}q;d" "$PROJECTS_FILE")
        fi

        if [ -z "$selected_project" ]; then
            echo "Invalid project number."
            return
        fi

        echo "$selected_project" > "$LAST_PROJECT_FILE"
    fi

    read -p "Enter BB command (init/start/stop): " command

    case "$command" in
        init)
            if command -v x-terminal-emulator > /dev/null 2>&1; then
                x-terminal-emulator -e "cd '$selected_project' && $BB_EXECUTABLE init; exec bash"
            elif command -v gnome-terminal > /dev/null 2>&1; then
                gnome-terminal -- bash -c "cd '$selected_project' && $BB_EXECUTABLE init; exec bash"
            elif command -v konsole > /dev/null 2>&1; then
                konsole -e bash -c "cd '$selected_project' && $BB_EXECUTABLE init; exec bash"
            elif command -v xterm > /dev/null 2>&1; then
                xterm -e "cd '$selected_project' && $BB_EXECUTABLE init; exec bash"
            else
                echo "No suitable terminal emulator found. Please run 'bb init' manually in your project directory."
            fi
            echo "Init command launched for project: $selected_project"
            ;;
        start|stop)
            (cd "$selected_project" && "$BB_EXECUTABLE" "$command")
            echo "Command executed for project: $selected_project"
            ;;
        *)
            echo "Invalid command. Please use init, start, or stop."
            ;;
    esac
}

while true; do
    echo "BB Project Manager"
    echo "=================="
    echo "1. List projects"
    echo "2. Add project"
    echo "3. Remove project"
    echo "4. Run BB command"
    echo "5. Exit"
    echo

    read -p "Enter your choice: " choice

    case $choice in
        1) list_projects ;;
        2) add_project ;;
        3) remove_project ;;
        4) run_command ;;
        5) exit 0 ;;
        *) echo "Invalid choice. Please try again." ;;
    esac

    echo
    read -p "Press Enter to continue..."
    clear
done