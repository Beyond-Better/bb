-- BB Manager for macOS

-- Global variables
global projectsFile
global lastProjectFile

-- Initialize
on initialize()
	-- Set up file paths
	set projectsFile to (path to library folder from user domain as text) & "Application Support:BB:bb-projects.txt"
	set lastProjectFile to (path to library folder from user domain as text) & "Application Support:BB:last-project.txt"
	
	-- Ensure directories and files exist
	do shell script "mkdir -p " & quoted form of (POSIX path of (path to library folder from user domain) & "Application Support/BB")
	do shell script "touch " & quoted form of (POSIX path of projectsFile)
	do shell script "touch " & quoted form of (POSIX path of lastProjectFile)
end initialize

-- Main menu
on run
	initialize()
	
	repeat
		set choice to choose from list {"List projects", "Add project", "Remove project", "Run BB command", "Quit"} with prompt "BB Project Manager" default items "Run BB command"
		
		if choice is false then
			exit repeat
		end if
		
		set selectedChoice to item 1 of choice
		
		if selectedChoice is "List projects" then
			listProjects()
		else if selectedChoice is "Add project" then
			addProject()
		else if selectedChoice is "Remove project" then
			removeProject()
		else if selectedChoice is "Run BB command" then
			runCommand()
		else if selectedChoice is "Quit" then
			exit repeat
		end if
	end repeat
end run

-- List projects
on listProjects()
	try
		set projectList to paragraphs of (read POSIX file (POSIX path of projectsFile))
		if length of projectList is 0 then
			display dialog "No projects configured." buttons {"OK"} default button "OK"
		else
			set projectText to ""
			repeat with i from 1 to length of projectList
				set projectText to projectText & i & ". " & item i of projectList & return
			end repeat
			display dialog projectText buttons {"OK"} default button "OK"
		end if
	on error errMsg
		display dialog "Error reading projects file: " & errMsg buttons {"OK"} default button "OK"
	end try
end listProjects

-- Add project
on addProject()
	set newProject to text returned of (display dialog "Enter the full path of the new project directory:" default answer "")
	if newProject is not "" then
		try
			do shell script "echo " & quoted form of newProject & " >> " & quoted form of (POSIX path of projectsFile)
			display dialog "Project added successfully." buttons {"OK"} default button "OK"
		on error errMsg
			display dialog "Error adding project: " & errMsg buttons {"OK"} default button "OK"
		end try
	end if
end addProject

-- Remove project
on removeProject()
	try
		set projectList to paragraphs of (read POSIX file (POSIX path of projectsFile))
		if length of projectList is 0 then
			display dialog "No projects configured." buttons {"OK"} default button "OK"
		else
			set choice to choose from list projectList with prompt "Select a project to remove:"
			if choice is not false then
				set projectToRemove to item 1 of choice
				do shell script "grep -v " & quoted form of projectToRemove & " " & quoted form of (POSIX path of projectsFile) & " > " & quoted form of (POSIX path of projectsFile) & ".tmp && mv " & quoted form of (POSIX path of projectsFile) & ".tmp " & quoted form of (POSIX path of projectsFile)
				display dialog "Project removed successfully." buttons {"OK"} default button "OK"
			end if
		end if
	on error errMsg
		display dialog "Error removing project: " & errMsg buttons {"OK"} default button "OK"
	end try
end removeProject

-- Run BB command
on runCommand()
	try
		set projectList to paragraphs of (read POSIX file (POSIX path of projectsFile))
		if length of projectList is 0 then
			display dialog "No projects configured. Please add a project first." buttons {"OK"} default button "OK"
			return
		end if
		
		if length of projectList is 1 then
			set selectedProject to item 1 of projectList
		else
			try
				set lastProject to read POSIX file (POSIX path of lastProjectFile)
			on error
				set lastProject to ""
			end try
			
			set choice to choose from list projectList with prompt "Select a project:" default items {lastProject}
			if choice is false then
				return
			end if
			set selectedProject to item 1 of choice
			do shell script "echo " & quoted form of selectedProject & " > " & quoted form of (POSIX path of lastProjectFile)
		end if
		
		set choice to choose from list ["init", "start", "stop"] with prompt "Select a command:" -- default items {lastProject}
		if choice is false then
			return
		end if
		set command to item 1 of choice
		
		if command is "init" or command is "start" or command is "stop" then
			if command is "init" then
				tell application "Terminal"
					activate
					do script "echo 'Preparing to run bb init' && sleep 1"
					delay 5 -- Longer delay before running bb init, to ensure complex bash/zsh profiles finish running
					--do script "cd " & quoted form of selectedProject & " && sleep 1" in front window
					do script "cd " & quoted form of selectedProject & " && echo ''" in front window
					delay 1 -- delay for `cd` to run
					do script "/usr/local/bin/bb init" in front window
				end tell
				activate
				display dialog "BB init command has been launched in Terminal. Please complete the initialization process there." buttons {"OK"} default button "OK"
			else
				do shell script "cd " & quoted form of selectedProject & " && /usr/local/bin/bb " & command
				if command is "start" then
					display dialog "BB has been started for the selected project." buttons {"OK"} default button "OK"
				else if command is "stop" then
					display dialog "BB has been stopped for the selected project." buttons {"OK"} default button "OK"
				end if
			end if
		else
			display dialog "Invalid command. Please use init, start, or stop." buttons {"OK"} default button "OK"
		end if
	on error errMsg
		display dialog "Error running command: " & errMsg buttons {"OK"} default button "OK"
	end try
end runCommand