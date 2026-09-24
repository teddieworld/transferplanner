#scrape data off of Mt.Sac course catalog sites

import requests #use requests to grab website
from bs4 import BeautifulSoup #use BeautifulSoup class to parse html

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

#request data from Mt. Sac course catalog
response = requests.get("https://catalog.mtsac.edu/programs/coursesaz/csci/")
print(response.status_code)
#200 success; 404 doesn't exist; 403 access forbidden; 500 server error

#use BeautifulSoup to create an object of the site that is parsed
soup = BeautifulSoup(response.text, "html.parser") 

#search the whole site for tag <div> and class="courseblock"
course_blocks = soup.find_all(name = "div", class_ = "courseblock")

course_code, course_title= parse_course_title(course_blocks[0])
units = parse_units(course_blocks[0])