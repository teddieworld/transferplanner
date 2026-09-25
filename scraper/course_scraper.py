#scrape data off of Mt.Sac course catalog sites

import requests #use requests to grab website
from bs4 import BeautifulSoup #use BeautifulSoup class to parse html
import json #use json to export our data gathered

uc_transferable = None
csu_transferable = None

#functions to parse individual elements from the webpage
def parse_course_title(course_block):
    #using .find, locate the location of the "courseblocktitle" in each course block and get the text
    title_text = course_block.find(class_="courseblocktitle").get_text(strip = True).split(maxsplit=2)
    course_code = title_text[0] + " " + title_text[1]
    course_title = title_text[2]
    return course_code, course_title
def parse_units(course_block):
    unit_text = course_block.find(class_="coursehours")
    units = unit_text.find(name = "strong").get_text(strip = True).split(maxsplit=2)
    units = float(units[0])
    return units
def parse_transferability(course_block):
    course_hours_element = course_block.find(class_="coursehours")
    transferability_text = course_hours_element.find(name = "strong").next_sibling.strip()
    return "UC" in transferability_text, "CSU" in transferability_text
def parse_requirements(course_block):
    info = course_block.find_all(class_="info")
    requirements = []
    for i in info:
        raw_requirement = i.get_text(" ", strip = True).replace("\xa0", " ")
        course_requirements_type = i.find(name = "b").get_text(strip = True).rstrip(":")
        course_requirement = i.find_all(name = "a")
        course_requirement_list = []
        requirement = {}
        for j in course_requirement:
            course_requirement_list.append(j.get_text(" ", strip=True).replace("\xa0", " "))
        requirement["type"] = course_requirements_type
        requirement["courses"] = course_requirement_list
        requirement["raw"] = raw_requirement
        requirements.append(requirement)
    return requirements
def parse_description(course_block):
    description = course_block.find(class_="courseblockdesc").get_text(" ",strip=True)
    description = " ".join(description.split())
    return description  

def parse_course(course_block):
    course_list_dictionary = {}
    course_code, course_title= parse_course_title(course_block)
    units = parse_units(course_block)
    uc_transferable, csu_transferable = parse_transferability(course_block)
    requirement = parse_requirements(course_block)
    description = parse_description(course_block)

    course_list_dictionary["code"] = course_code
    course_list_dictionary["title"] = course_title
    course_list_dictionary["units"] = units
    course_list_dictionary["uc_transferable"] = uc_transferable
    course_list_dictionary["csu_transferable"] = csu_transferable
    course_list_dictionary["requirements"] = requirement
    course_list_dictionary["description"] = description
    return course_list_dictionary
def parse_subject_page(url):
    page_course_lists = []
    #request data from Mt. Sac course catalog
    response = requests.get(url)

    #200 success; 404 doesn't exist; 403 access forbidden; 500 server error
    response.raise_for_status()

    #use BeautifulSoup to create an object of the site that is parsed
    soup = BeautifulSoup(response.text, "html.parser") 

    #search the whole site for tag <div> and class="courseblock"
    course_blocks = soup.find_all(name = "div", class_ = "courseblock")

    #iterate through each course block and parse information off it
    for i in course_blocks:
        page_course_lists.append(parse_course(i))

    return page_course_lists
def save_courses_json(courses, filepath):
    with open(filepath, mode="w") as file:
        json.dump(courses, file, indent=4)


page_courses = parse_subject_page("https://catalog.mtsac.edu/programs/coursesaz/csci/")
save_courses_json(page_courses, "data/csci_courses.json")





