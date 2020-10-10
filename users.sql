CREATE TABLE users (
id INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
firstname VARCHAR(255) NOT NULL,
lastname VARCHAR(255) NOT NULL,
email VARCHAR(255),
email_verified BOOLEAN,
password VARCHAR(255)
);

-- Password is helloworld
INSERT INTO users (firstname, lastname, email, email_verified, password) VALUES("John", "Doe", "john@doe.com", 1, "$2a$04$IpKqZjMNAPP6ZfgYAKw9FOk.t3Dfrg4MJXtdRPqIF3a3Uko6LkA96")